import { NextRequest, NextResponse } from 'next/server';
import { getDatasetByIdFull } from '@/lib/db/queries';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('datasets');

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ datasetId: string }> }
) {
  try {
    const { datasetId } = await params;
    const result = await getDatasetByIdFull(datasetId);

    if (!result) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }

    return NextResponse.json({
      dataset: result.dataset,
      latestRun: result.latestRun,
    });
  } catch (error) {
    log.error({ error }, 'Failed to get dataset');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get dataset' },
      { status: 500 }
    );
  }
}
