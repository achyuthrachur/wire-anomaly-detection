import { NextRequest, NextResponse } from 'next/server';
import { getModelById, listModelVersionsByModelId } from '@/lib/db/queries';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('models');

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ modelId: string }> }
) {
  try {
    const { modelId } = await params;
    const model = await getModelById(modelId);

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    const versions = await listModelVersionsByModelId(modelId);

    return NextResponse.json({ model, versions });
  } catch (error) {
    log.error({ error }, 'Failed to get model');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get model' },
      { status: 500 }
    );
  }
}
