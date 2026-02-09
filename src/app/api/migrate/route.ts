import { NextResponse } from 'next/server';
import { migrate } from '@/lib/db/migrate';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('migrate');

export async function POST() {
  try {
    await migrate();
    log.info('Migration completed successfully');
    return NextResponse.json({ success: true, message: 'Migration completed' });
  } catch (error) {
    log.error({ error }, 'Migration failed');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    );
  }
}
