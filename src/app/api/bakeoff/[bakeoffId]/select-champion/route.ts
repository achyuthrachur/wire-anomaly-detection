import { NextRequest, NextResponse } from 'next/server';
import { getBakeoffById, setChampionVersion } from '@/lib/db/queries';
import { SetChampionRequestSchema } from '@/lib/db/types';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('bakeoff');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bakeoffId: string }> }
) {
  try {
    const { bakeoffId } = await params;
    const body = await request.json();
    const parsed = SetChampionRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const bakeoff = await getBakeoffById(bakeoffId);
    if (!bakeoff) {
      return NextResponse.json({ error: 'Bakeoff not found' }, { status: 404 });
    }

    const { modelVersionId } = parsed.data;

    // Validate that the version is one of the bakeoff candidates
    if (!bakeoff.candidate_version_ids.includes(modelVersionId)) {
      return NextResponse.json(
        {
          error: 'Model version is not a candidate in this bakeoff',
        },
        { status: 400 }
      );
    }

    await setChampionVersion(bakeoff.model_id, modelVersionId);
    log.info(
      { bakeoffId, modelId: bakeoff.model_id, modelVersionId },
      'Champion selected from bakeoff'
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error({ error }, 'Failed to select champion from bakeoff');
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to select champion',
      },
      { status: 500 }
    );
  }
}
