import { NextRequest, NextResponse } from 'next/server';
import { listDatasets } from '@/lib/db/queries';
import type { DatasetRole } from '@/lib/db/types';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('datasets');

const VALID_ROLES: DatasetRole[] = ['uploaded', 'training', 'scoring'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get('role');

    let role: DatasetRole | undefined;
    if (roleParam) {
      if (!VALID_ROLES.includes(roleParam as DatasetRole)) {
        return NextResponse.json(
          { error: `Invalid role. Allowed: ${VALID_ROLES.join(', ')}` },
          { status: 400 }
        );
      }
      role = roleParam as DatasetRole;
    }

    const datasets = await listDatasets(role);
    return NextResponse.json({ datasets });
  } catch (error) {
    log.error({ error }, 'Failed to list datasets');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list datasets' },
      { status: 500 }
    );
  }
}
