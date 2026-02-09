import { sql } from './client';

/**
 * Run idempotent migrations that create (or verify) the required tables and
 * indexes. Safe to call on every cold-start -- every statement uses
 * IF NOT EXISTS.
 */
export async function migrate() {
  await sql(`
    CREATE TABLE IF NOT EXISTS datasets (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name          TEXT        NOT NULL,
      source_format TEXT        NOT NULL CHECK (source_format IN ('csv','xlsx')),
      blob_url      TEXT        NOT NULL,
      schema_json   JSONB       NOT NULL,
      row_count     BIGINT      NOT NULL DEFAULT 0,
      fingerprint   TEXT        NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await sql(`
    CREATE TABLE IF NOT EXISTS runs (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      dataset_id      UUID        NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
      status          TEXT        NOT NULL CHECK (status IN ('created','validated','failed')),
      validation_json JSONB       NOT NULL DEFAULT '{}'::jsonb,
      profiling_json  JSONB       NOT NULL DEFAULT '{}'::jsonb,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await sql(
    `CREATE INDEX IF NOT EXISTS idx_runs_dataset_id ON runs(dataset_id)`,
  );
  await sql(
    `CREATE INDEX IF NOT EXISTS idx_datasets_fingerprint ON datasets(fingerprint)`,
  );
}
