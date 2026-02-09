import { NextRequest, NextResponse } from 'next/server';
import { insertModel } from '@/lib/db/queries';
import { CreateModelRequestSchema } from '@/lib/db/types';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('models');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateModelRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, description } = parsed.data;
    const model = await insertModel(name, description);
    log.info({ modelId: model.id, name }, 'Model created');

    return NextResponse.json({ modelId: model.id });
  } catch (error) {
    log.error({ error }, 'Failed to create model');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create model' },
      { status: 500 }
    );
  }
}
