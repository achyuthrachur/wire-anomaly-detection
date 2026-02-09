import { sql } from './client';
import type { Dataset, Run, RunWithDataset } from './types';

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

export async function insertDataset(
  dataset: Omit<Dataset, 'id' | 'created_at'>,
): Promise<Dataset> {
  const rows = await sql(
    `
    INSERT INTO datasets (name, source_format, blob_url, schema_json, row_count, fingerprint)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      dataset.name,
      dataset.source_format,
      dataset.blob_url,
      JSON.stringify(dataset.schema_json),
      dataset.row_count,
      dataset.fingerprint,
    ],
  );
  return rows[0] as unknown as Dataset;
}

export async function findDatasetByFingerprint(
  fingerprint: string,
): Promise<Dataset | null> {
  const rows = await sql(
    `SELECT * FROM datasets WHERE fingerprint = $1 LIMIT 1`,
    [fingerprint],
  );
  return (rows[0] as unknown as Dataset) ?? null;
}

export async function getDatasetById(id: string): Promise<Dataset | null> {
  const rows = await sql(`SELECT * FROM datasets WHERE id = $1`, [id]);
  return (rows[0] as unknown as Dataset) ?? null;
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export async function insertRun(datasetId: string): Promise<Run> {
  const rows = await sql(
    `
    INSERT INTO runs (dataset_id, status)
    VALUES ($1, 'created')
    RETURNING *
    `,
    [datasetId],
  );
  return rows[0] as unknown as Run;
}

export async function updateRunStatus(
  runId: string,
  status: Run['status'],
  validationJson: unknown,
  profilingJson: unknown,
): Promise<Run> {
  const rows = await sql(
    `
    UPDATE runs
    SET status = $1, validation_json = $2, profiling_json = $3
    WHERE id = $4
    RETURNING *
    `,
    [
      status,
      JSON.stringify(validationJson),
      JSON.stringify(profilingJson),
      runId,
    ],
  );
  return rows[0] as unknown as Run;
}

export async function listRuns(): Promise<RunWithDataset[]> {
  const rows = await sql(`
    SELECT r.*, d.name AS dataset_name, d.source_format, d.row_count
    FROM runs r
    JOIN datasets d ON r.dataset_id = d.id
    ORDER BY r.created_at DESC
  `);
  return rows as unknown as RunWithDataset[];
}

export async function getRunById(
  runId: string,
): Promise<
  (RunWithDataset & { blob_url: string; schema_json: unknown }) | null
> {
  const rows = await sql(
    `
    SELECT r.*, d.name AS dataset_name, d.source_format, d.row_count,
           d.blob_url, d.schema_json
    FROM runs r
    JOIN datasets d ON r.dataset_id = d.id
    WHERE r.id = $1
    `,
    [runId],
  );
  return (
    (rows[0] as unknown as RunWithDataset & {
      blob_url: string;
      schema_json: unknown;
    }) ?? null
  );
}
