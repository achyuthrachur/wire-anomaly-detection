import { NextRequest, NextResponse } from 'next/server';
import { getDatasetById, insertRun } from '@/lib/db/queries';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('runs');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { datasetId } = body;

    if (!datasetId) {
      return NextResponse.json({ error: 'datasetId is required' }, { status: 400 });
    }

    const dataset = await getDatasetById(datasetId);
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }

    const run = await insertRun(datasetId);
    log.info({ runId: run.id, datasetId }, 'Run created');

    return NextResponse.json({ run });
  } catch (error) {
    log.error({ error }, 'Failed to create run');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create run' },
      { status: 500 }
    );
  }
}
