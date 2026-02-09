import { NextRequest, NextResponse } from 'next/server';
import { getDatasetById } from '@/lib/db/queries';
import { downloadDatasetFile } from '@/lib/blob/client';
import { parseFile } from '@/lib/schema/parsers';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('datasets');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ datasetId: string }> }
) {
  try {
    const { datasetId } = await params;
    const { searchParams } = new URL(request.url);

    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);
    const limit = Math.min(
      500,
      Math.max(1, parseInt(searchParams.get('limit') ?? '200', 10) || 200)
    );

    const dataset = await getDatasetById(datasetId);
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }

    const arrayBuffer = await downloadDatasetFile(dataset.blob_url);
    const parsed = parseFile(Buffer.from(arrayBuffer), dataset.source_format as 'csv' | 'xlsx');

    const columns = parsed.headers;
    const slicedRows = parsed.rows.slice(offset, offset + limit);

    return NextResponse.json({
      columns,
      rows: slicedRows.map((r) => columns.map((c) => r[c] ?? '')),
      offset,
      limit,
      rowCount: parsed.totalRows,
    });
  } catch (error) {
    log.error({ error }, 'Failed to preview dataset');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to preview dataset' },
      { status: 500 }
    );
  }
}
