import { NextRequest, NextResponse } from 'next/server';
import type { BakeoffProgress } from '@/lib/db/types';
import type { CandidateResult } from '@/lib/ml/types';
import { getBakeoffById, updateBakeoffStatus } from '@/lib/db/queries';
import { deleteDatasetFile } from '@/lib/blob/client';
import { applyRubric, generateNarrative } from '@/lib/ml/rubric';
import { createChildLogger } from '@/lib/logging/logger';

export const maxDuration = 30;

const log = createChildLogger('bakeoff:finalize');

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ bakeoffId: string }> }
) {
  try {
    const { bakeoffId } = await params;

    // Fetch bakeoff with candidates
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

    // Extract progress
    const progress = (bakeoff.error_json as { progress?: BakeoffProgress } | null)?.progress;
    if (!progress) {
      return NextResponse.json({ error: 'Bakeoff has no progress data' }, { status: 400 });
    }

    // Validate all candidates are trained
    const expectedCount = progress.candidateConfigs.length;
    const trainedCount = bakeoff.candidate_version_ids.length;
    if (trainedCount < expectedCount) {
      return NextResponse.json(
        {
          error: `Not all candidates trained: ${trainedCount}/${expectedCount}`,
          candidatesDone: trainedCount,
          candidateCount: expectedCount,
        },
        { status: 409 }
      );
    }

    // Build CandidateResult[] from DB model versions (only metrics and importance needed for rubric)
    const candidateResults: CandidateResult[] = bakeoff.candidates.map((mv) => ({
      algorithm: mv.algorithm,
      hyperparams: mv.hyperparams_json,
      // Model is not needed for rubric — provide a stub
      model: {
        algorithm: mv.algorithm,
        predict: () => 0,
        predictBatch: (X: number[][]) => X.map(() => 0),
        serialize: () => '',
        featureNames: [],
      },
      metrics: mv.metrics_json,
      importance: mv.global_importance_json,
      serializedArtifact: '',
    }));

    // Apply rubric
    const { championIndex } = applyRubric(candidateResults, bakeoff.rubric_json);
    const championVersionId = bakeoff.candidate_version_ids[championIndex];

    // Generate narrative
    const { narrativeShort, narrativeLong } = generateNarrative(
      candidateResults,
      championIndex,
      bakeoff.rubric_json
    );

    // Update bakeoff to completed (this clears error_json via the query logic)
    await updateBakeoffStatus(bakeoff.id, 'completed', {
      candidateVersionIds: bakeoff.candidate_version_ids,
      championVersionId,
      narrativeShort,
      narrativeLong,
    });

    // Cleanup: delete features blob
    try {
      await deleteDatasetFile(progress.featuresBlobUrl);
    } catch (cleanupErr) {
      log.warn({ bakeoffId, error: cleanupErr }, 'Failed to delete features blob (non-critical)');
    }

    log.info(
      { bakeoffId, championVersionId, candidateCount: candidateResults.length },
      'Bakeoff finalized'
    );

    return NextResponse.json({
      championVersionId,
      championAlgorithm: candidateResults[championIndex]?.algorithm,
      narrativeShort,
    });
  } catch (error) {
    log.error({ error }, 'Failed to finalize bakeoff');
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to finalize bakeoff',
      },
      { status: 500 }
    );
  }
}
