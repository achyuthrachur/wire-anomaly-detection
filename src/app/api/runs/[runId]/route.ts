import { NextRequest, NextResponse } from 'next/server';
import { getRunById } from '@/lib/db/queries';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('runs');

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const run = await getRunById(runId);

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json({ run });
  } catch (error) {
    log.error({ error }, 'Failed to get run');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get run' },
      { status: 500 }
    );
  }
}
