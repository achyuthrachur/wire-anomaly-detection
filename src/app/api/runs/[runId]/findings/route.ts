import { NextRequest, NextResponse } from 'next/server';
import { listFindingsByRunId, countFindingsByRunId } from '@/lib/db/queries';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('findings');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const offset = parseInt(searchParams.get('offset') ?? '0', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);
    const minScore = searchParams.get('minScore')
      ? parseFloat(searchParams.get('minScore')!)
      : undefined;
    const maxScore = searchParams.get('maxScore')
      ? parseFloat(searchParams.get('maxScore')!)
      : undefined;
    const reasonCodesParam = searchParams.get('reasonCodes');
    const reasonCodes = reasonCodesParam ? reasonCodesParam.split(',') : undefined;

    const filters = { minScore, maxScore, reasonCodes };

    const [findings, total] = await Promise.all([
      listFindingsByRunId(runId, offset, limit, filters),
      countFindingsByRunId(runId, filters),
    ]);

    return NextResponse.json({
      findings: findings.map((f) => ({
        wireId: f.wire_id,
        rank: f.rank,
        score: f.score,
        predictedLabel: f.predicted_label,
        reasonCodes: f.reason_codes_json,
      })),
      offset,
      limit,
      total,
    });
  } catch (error) {
    log.error({ error }, 'Failed to list findings');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list findings' },
      { status: 500 }
    );
  }
}
