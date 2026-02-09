import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('admin-reset');

export async function POST() {
  try {
    log.info('Starting full demo data reset');

    // Delete in FK-safe order (children before parents)
    await sql('DELETE FROM findings');
    await sql('DELETE FROM runs');
    await sql('DELETE FROM synthetic_jobs');
    await sql('DELETE FROM bakeoffs');
    await sql('DELETE FROM model_versions');
    await sql('DELETE FROM models');
    await sql('DELETE FROM datasets');

    log.info('All demo data cleared successfully');

    return NextResponse.json({
      success: true,
      message: 'All demo data cleared',
    });
  } catch (error) {
    log.error({ error }, 'Failed to reset demo data');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reset demo data' },
      { status: 500 }
    );
  }
}
