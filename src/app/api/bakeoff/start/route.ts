import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { StartBakeoffRequestSchema } from '@/lib/db/types';
import type { RubricConfig } from '@/lib/db/types';
import {
  insertBakeoff,
  updateBakeoffStatus,
  insertModelVersion,
  getDatasetById,
} from '@/lib/db/queries';
import { uploadDatasetFile } from '@/lib/blob/client';
import { runBakeoff } from '@/lib/ml/runner';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('bakeoff');

const DEFAULT_RUBRIC: RubricConfig = {
  constraints: {
    minRecallAtReviewRate: 0.65,
    minPrecisionAtReviewRate: 0.08,
  },
  weights: {
    recallAtReviewRate: 0.4,
    prAuc: 0.25,
    precisionAtReviewRate: 0.15,
    stability: 0.1,
    explainability: 0.1,
  },
};

const DEFAULT_REVIEW_RATE = 0.005;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = StartBakeoffRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      datasetId,
      modelId,
      labelColumn,
      candidates,
      rubric,
      reviewRate: reviewRateInput,
    } = parsed.data;

    const rubricConfig: RubricConfig = rubric ?? DEFAULT_RUBRIC;
    const reviewRate = reviewRateInput ?? DEFAULT_REVIEW_RATE;

    // Validate dataset exists
    const dataset = await getDatasetById(datasetId);
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }

    // Insert bakeoff record with status = 'queued'
    const bakeoff = await insertBakeoff(modelId, datasetId, rubricConfig);
    log.info(
      { bakeoffId: bakeoff.id, modelId, datasetId, candidates: candidates.length },
      'Bakeoff queued'
    );

    // Return immediately with the bakeoff ID
    const response = NextResponse.json({ bakeoffId: bakeoff.id }, { status: 201 });

    // Run training in the background after the response is sent
    after(async () => {
      try {
        await updateBakeoffStatus(bakeoff.id, 'running');
        log.info({ bakeoffId: bakeoff.id }, 'Bakeoff running');

        // Normalize candidates to ensure hyperparams is always defined
        const normalizedCandidates = candidates.map((c) => ({
          algorithm: c.algorithm,
          hyperparams: c.hyperparams ?? {},
        }));

        const result = await runBakeoff(
          datasetId,
          normalizedCandidates,
          rubricConfig,
          labelColumn,
          reviewRate
        );

        // For each candidate, insert model version with artifact
        const versionIds: string[] = [];
        for (const candidate of result.candidates) {
          const artifactBlob = await uploadDatasetFile(
            `models/${bakeoff.id}/${candidate.algorithm}.json`,
            Buffer.from(candidate.serializedArtifact)
          );

          const version = await insertModelVersion({
            model_id: modelId,
            algorithm: candidate.algorithm,
            hyperparams_json: candidate.hyperparams,
            feature_spec_version: 'v1',
            trained_dataset_id: datasetId,
            artifact_blob_url: artifactBlob,
            metrics_json: candidate.metrics,
            global_importance_json: candidate.importance,
            explain_blob_url: null,
            is_champion: false,
          });

          versionIds.push(version.id);
        }

        // Determine champion
        const championVersionId = versionIds[result.recommendedChampionIndex];

        await updateBakeoffStatus(bakeoff.id, 'completed', {
          candidateVersionIds: versionIds,
          championVersionId,
          narrativeShort: result.narrativeShort,
          narrativeLong: result.narrativeLong,
        });

        log.info(
          { bakeoffId: bakeoff.id, championVersionId, candidateCount: versionIds.length },
          'Bakeoff completed'
        );
      } catch (error) {
        log.error({ bakeoffId: bakeoff.id, error }, 'Bakeoff failed');

        await updateBakeoffStatus(bakeoff.id, 'failed', {
          errorJson: {
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    });

    return response;
  } catch (error) {
    log.error({ error }, 'Failed to start bakeoff');
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to start bakeoff',
      },
      { status: 500 }
    );
  }
}
