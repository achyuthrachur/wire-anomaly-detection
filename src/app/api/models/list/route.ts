import { NextResponse } from 'next/server';
import { listModels } from '@/lib/db/queries';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('models');

export async function GET() {
  try {
    const models = await listModels();
    return NextResponse.json({ models });
  } catch (error) {
    log.error({ error }, 'Failed to list models');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list models' },
      { status: 500 }
    );
  }
}
