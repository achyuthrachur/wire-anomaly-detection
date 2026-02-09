import { NextRequest, NextResponse } from 'next/server';
import { getBakeoffById } from '@/lib/db/queries';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('bakeoff');

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bakeoffId: string }> }
) {
  try {
    const { bakeoffId } = await params;
    const bakeoff = await getBakeoffById(bakeoffId);

    if (!bakeoff) {
      return NextResponse.json({ error: 'Bakeoff not found' }, { status: 404 });
    }

    return NextResponse.json(bakeoff);
  } catch (error) {
    log.error({ error }, 'Failed to get bakeoff');
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get bakeoff',
      },
      { status: 500 }
    );
  }
}
