import { NextRequest, NextResponse } from 'next/server';
import { TrainCandidateRequestSchema } from '@/lib/db/types';
import type { BakeoffProgress } from '@/lib/db/types';
import { getBakeoffById, updateBakeoffStatus, insertModelVersion } from '@/lib/db/queries';
import { uploadDatasetFile, downloadDatasetFile } from '@/lib/blob/client';
import { trainSingleCandidate } from '@/lib/ml/runner';
import { createChildLogger } from '@/lib/logging/logger';

export const maxDuration = 55;

const log = createChildLogger('bakeoff:train');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bakeoffId: string }> }
) {
  try {
    const { bakeoffId } = await params;

    const body = await request.json();
    const parsed = TrainCandidateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { candidateIndex } = parsed.data;

    // Fetch bakeoff
    const bakeoff = await getBakeoffById(bakeoffId);
    if (!bakeoff) {
      return NextResponse.json({ error: 'Bakeoff not found' }, { status: 404 });
    }

    if (bakeoff.status !== 'running') {
      return NextResponse.json(
        { error: `Bakeoff is not running (status: ${bakeoff.status})` },
        { status: 409 }
      );
    }

    // Extract progress from error_json
    const progress = (bakeoff.error_json as { progress?: BakeoffProgress } | null)?.progress;
    if (!progress) {
      return NextResponse.json(
        { error: 'Bakeoff has no progress data — was /start called?' },
        { status: 400 }
      );
    }

    const { featuresBlobUrl, candidateConfigs, reviewRate } = progress;

    // Validate candidateIndex
    if (candidateIndex >= candidateConfigs.length) {
      return NextResponse.json(
        {
          error: `candidateIndex ${candidateIndex} out of range (${candidateConfigs.length} candidates)`,
        },
        { status: 400 }
      );
    }

    // Duplicate guard: candidateIndex must equal current number of trained candidates
    const trainedCount = bakeoff.candidate_version_ids.length;
    if (candidateIndex !== trainedCount) {
      return NextResponse.json(
        {
          error: `Duplicate or out-of-order: expected candidateIndex ${trainedCount}, got ${candidateIndex}`,
          candidatesDone: trainedCount,
        },
        { status: 409 }
      );
    }

    // Download feature matrix
    const featuresBuffer = await downloadDatasetFile(featuresBlobUrl);
    const featuresData = JSON.parse(Buffer.from(featuresBuffer).toString('utf-8')) as {
      X: number[][];
      y: number[];
      featureNames: string[];
    };

    const config = candidateConfigs[candidateIndex];

    // Train single candidate
    log.info({ bakeoffId, algorithm: config.algorithm, candidateIndex }, 'Training candidate');

    const result = trainSingleCandidate(
      { algorithm: config.algorithm, hyperparams: config.hyperparams },
      featuresData.X,
      featuresData.y,
      featuresData.featureNames,
      reviewRate
    );

    // Upload artifact to blob
    const artifactBlobUrl = await uploadDatasetFile(
      `models/${bakeoffId}/${config.algorithm}.json`,
      Buffer.from(result.serializedArtifact)
    );

    // Insert model version
    const version = await insertModelVersion({
      model_id: bakeoff.model_id,
      algorithm: result.algorithm,
      hyperparams_json: result.hyperparams,
      feature_spec_version: 'v1',
      trained_dataset_id: bakeoff.dataset_id,
      artifact_blob_url: artifactBlobUrl,
      metrics_json: result.metrics,
      global_importance_json: result.importance,
      explain_blob_url: null,
      is_champion: false,
    });

    // Append version ID to bakeoff
    const updatedVersionIds = [...bakeoff.candidate_version_ids, version.id];
    await updateBakeoffStatus(bakeoff.id, 'running', {
      candidateVersionIds: updatedVersionIds,
      errorJson: { progress }, // preserve progress data
    });

    log.info(
      { bakeoffId, algorithm: config.algorithm, versionId: version.id, failed: result.failed },
      'Candidate trained'
    );

    return NextResponse.json({
      versionId: version.id,
      algorithm: result.algorithm,
      metrics: result.metrics,
      failed: result.failed,
      candidatesDone: updatedVersionIds.length,
      candidateCount: candidateConfigs.length,
    });
  } catch (error) {
    log.error({ error }, 'Failed to train candidate');
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to train candidate',
      },
      { status: 500 }
    );
  }
}
