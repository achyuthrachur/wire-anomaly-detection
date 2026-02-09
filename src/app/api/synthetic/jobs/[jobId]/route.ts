import { NextRequest, NextResponse } from 'next/server';
import { getSyntheticJobById } from '@/lib/db/queries';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('synthetic');

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const job = await getSyntheticJobById(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Synthetic job not found' }, { status: 404 });
    }

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        trainingDatasetId: job.training_dataset_id,
        scoringDatasetId: job.scoring_dataset_id,
        config: job.config_json,
        error: job.error_json,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
      },
    });
  } catch (error) {
    log.error({ error }, 'Failed to get synthetic job');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get synthetic job' },
      { status: 500 }
    );
  }
}
