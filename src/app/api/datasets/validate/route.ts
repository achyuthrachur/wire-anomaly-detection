import { NextRequest, NextResponse } from 'next/server';
import { getDatasetById, updateRunStatus } from '@/lib/db/queries';
import { downloadDatasetFile } from '@/lib/blob/client';
import { parseFile } from '@/lib/schema/parsers';
import { inferSchema } from '@/lib/schema/inference';
import { validateDataset } from '@/lib/schema/validation';
import { profileDataset } from '@/lib/profiling/profiler';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('validate');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { datasetId, runId } = body;

    if (!datasetId || !runId) {
      return NextResponse.json(
        { error: 'datasetId and runId are required' },
        { status: 400 }
      );
    }

    // 1. Fetch dataset
    const dataset = await getDatasetById(datasetId);
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }

    log.info({ datasetId, runId, format: dataset.source_format }, 'Starting validation');

    // 2. Download file from Blob
    const arrayBuffer = await downloadDatasetFile(dataset.blob_url);
    const buffer = Buffer.from(arrayBuffer);

    // 3. Full parse (no preview limit)
    const parsed = parseFile(buffer, dataset.source_format as 'csv' | 'xlsx');

    // 4. Re-infer schema on full data
    const schema = inferSchema(parsed);

    // 5. Run validation
    const validation = validateDataset(parsed, schema);

    // 6. Run profiling
    const profiling = profileDataset(parsed, schema);

    // 7. Determine status
    const hasMissingRequired = validation.requiredColumns.missing.length > 0;
    const status = hasMissingRequired ? 'failed' : 'validated' as const;

    // 8. Update run
    await updateRunStatus(runId, status, validation, profiling);

    log.info({ runId, status, rowCount: profiling.rowCount }, 'Validation complete');

    return NextResponse.json({
      status,
      validation,
      profiling,
    });
  } catch (error) {
    log.error({ error }, 'Validation failed');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Validation failed' },
      { status: 500 }
    );
  }
}
