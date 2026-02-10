import { NextRequest, NextResponse } from 'next/server';
import { StartScoringRequestSchema } from '@/lib/db/types';

export const maxDuration = 55;
import {
  getDatasetById,
  getChampionVersionByModelId,
  getModelVersionById,
  insertRun,
  updateRunScoring,
  insertFindingsBatch,
} from '@/lib/db/queries';
import { uploadDatasetFile } from '@/lib/blob/client';
import { runScoringPipeline } from '@/lib/ml/scoring';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('scoring');

const DEFAULT_REVIEW_RATE = 0.005;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = StartScoringRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { datasetId, modelId, reviewRate: reviewRateInput } = parsed.data;
    let { modelVersionId } = parsed.data;
    const threshold = parsed.data.threshold ?? null;
    const reviewRate = reviewRateInput ?? DEFAULT_REVIEW_RATE;

    // Validate dataset exists
    const dataset = await getDatasetById(datasetId);
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }

    // Resolve model version
    if (!modelVersionId) {
      const champion = await getChampionVersionByModelId(modelId);
      if (!champion) {
        return NextResponse.json(
          { error: 'No champion model version found. Run a bake-off first.' },
          { status: 400 }
        );
      }
      modelVersionId = champion.id;
    } else {
      const version = await getModelVersionById(modelVersionId);
      if (!version) {
        return NextResponse.json({ error: 'Model version not found' }, { status: 404 });
      }
    }

    // Create run record with status='scoring'
    const run = await insertRun(datasetId);
    await updateRunScoring(run.id, 'scoring', modelVersionId);

    log.info({ runId: run.id, datasetId, modelVersionId, reviewRate }, 'Scoring run started');

    // Run scoring pipeline synchronously (same pattern as bake-off fix)
    try {
      const result = await runScoringPipeline(
        datasetId,
        modelVersionId!,
        reviewRate,
        threshold,
        200
      );

      // Upload scored CSV to Blob
      const outputsBlobUrl = await uploadDatasetFile(
        `scoring/${run.id}/scored-output.csv`,
        result.scoredCsvBuffer
      );

      // Insert findings into database
      const findingsWithRunId = result.findings.map((f) => ({
        ...f,
        run_id: run.id,
      }));
      await insertFindingsBatch(findingsWithRunId);

      // Update run with summary
      await updateRunScoring(run.id, 'scored', modelVersionId!, outputsBlobUrl, result.summary);

      log.info(
        {
          runId: run.id,
          flaggedCount: result.summary.flaggedCount,
          findingsStored: result.findings.length,
        },
        'Scoring run completed'
      );

      return NextResponse.json({ runId: run.id }, { status: 201 });
    } catch (error) {
      log.error({ runId: run.id, error }, 'Scoring run failed');
      await updateRunScoring(run.id, 'failed', modelVersionId!, undefined, {
        reviewRate,
        rowCount: 0,
        flaggedCount: 0,
      });
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Scoring pipeline failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    log.error({ error }, 'Failed to start scoring');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start scoring' },
      { status: 500 }
    );
  }
}
