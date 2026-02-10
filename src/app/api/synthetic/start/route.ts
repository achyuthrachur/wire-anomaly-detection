import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { StartSyntheticRequestSchema } from '@/lib/db/types';

export const maxDuration = 300; // Allow up to 5 min for synthetic generation (requires Vercel Pro)
import type { SyntheticConfig } from '@/lib/db/types';
import { insertSyntheticJob, updateSyntheticJobStatus, insertDataset } from '@/lib/db/queries';
import { uploadDatasetFile } from '@/lib/blob/client';
import { generateWireDataset } from '@/lib/synthetic/generator';
import { inferSchema } from '@/lib/schema/inference';
import { createChildLogger } from '@/lib/logging/logger';
import crypto from 'crypto';

const log = createChildLogger('synthetic');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = StartSyntheticRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const config = parsed.data.config as SyntheticConfig;

    // Insert job record
    const job = await insertSyntheticJob(config);
    log.info({ jobId: job.id }, 'Synthetic job queued');

    const response = NextResponse.json({ jobId: job.id }, { status: 201 });

    // Run generation in background
    after(async () => {
      try {
        await updateSyntheticJobStatus(job.id, 'running');
        log.info({ jobId: job.id }, 'Synthetic job running');

        // ---- Generate Training Dataset ----
        const trainingResult = generateWireDataset(config, 'training', config.seed);
        const trainingBuffer = Buffer.from(trainingResult.csv, 'utf-8');
        const trainingFingerprint = crypto
          .createHash('sha256')
          .update(trainingBuffer)
          .digest('hex');

        const trainingBlobUrl = await uploadDatasetFile(
          `synthetic/training-${job.id}.csv`,
          trainingBuffer
        );

        // Infer schema from a small sample
        const trainingRows = trainingResult.csv.split('\n');
        const trainingHeaders = trainingRows[0].split(',').map((h) => h.trim());
        const trainingSample = trainingRows.slice(1, 51).map((line) => {
          const values = line.split(',');
          const row: Record<string, string> = {};
          trainingHeaders.forEach((h, i) => {
            row[h] = (values[i] ?? '').trim();
          });
          return row;
        });

        const trainingSchema = inferSchema({
          headers: trainingHeaders,
          rows: trainingSample,
          totalRows: trainingResult.rowCount,
        });

        const trainingDataset = await insertDataset({
          name: `Synthetic Training (seed=${config.seed})`,
          source_format: 'csv',
          blob_url: trainingBlobUrl,
          schema_json: trainingSchema,
          row_count: trainingResult.rowCount,
          fingerprint: trainingFingerprint,
          dataset_role: 'training',
          generator_config_json: config as unknown as Record<string, unknown>,
          label_present: true,
        });

        log.info(
          { jobId: job.id, datasetId: trainingDataset.id, rows: trainingResult.rowCount },
          'Training dataset created'
        );

        // ---- Generate Scoring Dataset ----
        const scoringResult = generateWireDataset(config, 'scoring', config.seed + 1000);
        const scoringBuffer = Buffer.from(scoringResult.csv, 'utf-8');
        const scoringFingerprint = crypto.createHash('sha256').update(scoringBuffer).digest('hex');

        const scoringBlobUrl = await uploadDatasetFile(
          `synthetic/scoring-${job.id}.csv`,
          scoringBuffer
        );

        const scoringRows = scoringResult.csv.split('\n');
        const scoringHeaders = scoringRows[0].split(',').map((h) => h.trim());
        const scoringSample = scoringRows.slice(1, 51).map((line) => {
          const values = line.split(',');
          const row: Record<string, string> = {};
          scoringHeaders.forEach((h, i) => {
            row[h] = (values[i] ?? '').trim();
          });
          return row;
        });

        const scoringSchema = inferSchema({
          headers: scoringHeaders,
          rows: scoringSample,
          totalRows: scoringResult.rowCount,
        });

        const scoringDataset = await insertDataset({
          name: `Synthetic Scoring (seed=${config.seed})`,
          source_format: 'csv',
          blob_url: scoringBlobUrl,
          schema_json: scoringSchema,
          row_count: scoringResult.rowCount,
          fingerprint: scoringFingerprint,
          dataset_role: 'scoring',
          generator_config_json: config as unknown as Record<string, unknown>,
          label_present: true, // Labels exist but may be hidden in UI
        });

        log.info(
          { jobId: job.id, datasetId: scoringDataset.id, rows: scoringResult.rowCount },
          'Scoring dataset created'
        );

        // ---- Mark job completed ----
        await updateSyntheticJobStatus(job.id, 'completed', {
          trainingDatasetId: trainingDataset.id,
          scoringDatasetId: scoringDataset.id,
        });

        log.info({ jobId: job.id }, 'Synthetic job completed');
      } catch (error) {
        log.error({ jobId: job.id, error }, 'Synthetic job failed');
        await updateSyntheticJobStatus(job.id, 'failed', {
          errorJson: {
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    });

    return response;
  } catch (error) {
    log.error({ error }, 'Failed to start synthetic generation');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start synthetic generation' },
      { status: 500 }
    );
  }
}
