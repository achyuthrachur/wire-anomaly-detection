import { NextRequest, NextResponse } from 'next/server';
import { StartBakeoffRequestSchema } from '@/lib/db/types';
import type { RubricConfig, BakeoffProgress } from '@/lib/db/types';
import { insertBakeoff, updateBakeoffStatus, getDatasetById } from '@/lib/db/queries';
import { uploadDatasetFile, downloadDatasetFile } from '@/lib/blob/client';
import { buildFeatureMatrix } from '@/lib/ml/features';
import { parseFile } from '@/lib/schema/parsers';
import { createChildLogger } from '@/lib/logging/logger';

export const maxDuration = 30;

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

    // ---- Synchronous: build features and upload to blob ----

    // 1. Download and parse dataset
    const arrayBuffer = await downloadDatasetFile(dataset.blob_url);
    const buffer = Buffer.from(arrayBuffer);
    const parsedFile = parseFile(buffer, dataset.source_format);

    if (parsedFile.rows.length === 0) {
      await updateBakeoffStatus(bakeoff.id, 'failed', {
        errorJson: { message: 'Dataset has no rows' },
      });
      return NextResponse.json({ error: 'Dataset has no rows' }, { status: 400 });
    }

    // 2. Build feature matrix
    const schema = dataset.schema_json;
    const { X, y, featureNames, normContext } = buildFeatureMatrix(
      parsedFile.rows,
      schema,
      labelColumn
    );

    if (X.length === 0 || featureNames.length === 0) {
      await updateBakeoffStatus(bakeoff.id, 'failed', {
        errorJson: { message: 'Feature matrix is empty' },
      });
      return NextResponse.json(
        { error: 'Feature matrix is empty — check that the dataset has usable columns' },
        { status: 400 }
      );
    }

    // Validate both classes exist
    const positiveCount = y.reduce((sum, v) => sum + v, 0);
    const negativeCount = y.length - positiveCount;

    if (positiveCount === 0) {
      const msg = `Label column "${labelColumn}" has no positive (1) labels.`;
      await updateBakeoffStatus(bakeoff.id, 'failed', { errorJson: { message: msg } });
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (negativeCount === 0) {
      const msg = `Label column "${labelColumn}" has no negative (0) labels.`;
      await updateBakeoffStatus(bakeoff.id, 'failed', { errorJson: { message: msg } });
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // 3. Upload feature matrix to blob for train-candidate steps
    const featuresPayload = JSON.stringify({ X, y, featureNames, normContext });
    const featuresBlobUrl = await uploadDatasetFile(
      `bakeoff/${bakeoff.id}/features.json`,
      Buffer.from(featuresPayload)
    );

    // 4. Store progress in error_json and set status to running
    const normalizedCandidates = candidates.map((c) => ({
      algorithm: c.algorithm,
      hyperparams: c.hyperparams ?? {},
    }));

    const progress: BakeoffProgress = {
      featuresBlobUrl,
      candidateConfigs: normalizedCandidates,
      labelColumn,
      reviewRate,
    };

    await updateBakeoffStatus(bakeoff.id, 'running', {
      errorJson: { progress },
    });

    log.info(
      { bakeoffId: bakeoff.id, featureCount: featureNames.length, sampleCount: X.length },
      'Features built and uploaded — ready for sequential training'
    );

    return NextResponse.json(
      {
        bakeoffId: bakeoff.id,
        candidateCount: normalizedCandidates.length,
      },
      { status: 201 }
    );
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
