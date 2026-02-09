import { NextResponse } from 'next/server';
import { listRuns } from '@/lib/db/queries';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('runs');

export async function GET() {
  try {
    const runs = await listRuns();
    return NextResponse.json({ runs });
  } catch (error) {
    log.error({ error }, 'Failed to list runs');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list runs' },
      { status: 500 }
    );
  }
}
