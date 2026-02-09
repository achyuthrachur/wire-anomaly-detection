import { NextRequest, NextResponse } from 'next/server';
import { uploadDatasetFile } from '@/lib/blob/client';
import { insertDataset, findDatasetByFingerprint, insertRun } from '@/lib/db/queries';
import { parseFile } from '@/lib/schema/parsers';
import { inferSchema } from '@/lib/schema/inference';
import { computeFingerprint } from '@/lib/utils/crypto';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('upload');

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file extension
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: 50MB` },
        { status: 400 }
      );
    }

    const format = ext === '.csv' ? 'csv' : 'xlsx' as const;
    const buffer = Buffer.from(await file.arrayBuffer());

    log.info({ filename: file.name, size: file.size, format }, 'Processing upload');

    // 1. Upload to Blob storage
    const blobUrl = await uploadDatasetFile(file.name, buffer);

    // 2. Parse sample for schema inference
    const parsed = parseFile(buffer, format, { preview: true });

    // 3. Infer schema
    const schema = inferSchema(parsed);

    // 4. Compute fingerprint for dedup
    const fingerprint = computeFingerprint(
      JSON.stringify(schema),
      file.size,
      parsed.totalRows,
    );

    // 5. Check for duplicates
    const existing = await findDatasetByFingerprint(fingerprint);
    if (existing) {
      log.info({ fingerprint, existingId: existing.id }, 'Duplicate dataset detected');
      // Still create a new run against the existing dataset
      const run = await insertRun(existing.id);
      return NextResponse.json({
        datasetId: existing.id,
        runId: run.id,
        blobUrl: existing.blob_url,
        schema: { columns: existing.schema_json?.columns ?? schema.columns },
        duplicate: true,
      });
    }

    // 6. Insert dataset record
    const dataset = await insertDataset({
      name: file.name,
      source_format: format,
      blob_url: blobUrl,
      schema_json: schema,
      row_count: parsed.totalRows,
      fingerprint,
    });

    // 7. Create run
    const run = await insertRun(dataset.id);

    log.info({ datasetId: dataset.id, runId: run.id }, 'Upload complete');

    return NextResponse.json({
      datasetId: dataset.id,
      runId: run.id,
      blobUrl: dataset.blob_url,
      schema,
    });
  } catch (error) {
    log.error({ error }, 'Upload failed');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
