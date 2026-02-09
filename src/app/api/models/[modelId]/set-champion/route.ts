import { NextRequest, NextResponse } from 'next/server';
import { setChampionVersion, getModelById } from '@/lib/db/queries';
import { SetChampionRequestSchema } from '@/lib/db/types';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('models');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ modelId: string }> }
) {
  try {
    const { modelId } = await params;
    const body = await request.json();
    const parsed = SetChampionRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const model = await getModelById(modelId);
    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    const { modelVersionId } = parsed.data;
    await setChampionVersion(modelId, modelVersionId);
    log.info({ modelId, modelVersionId }, 'Champion version set');

    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error({ error }, 'Failed to set champion version');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to set champion' },
      { status: 500 }
    );
  }
}
