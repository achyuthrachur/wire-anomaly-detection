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

  await sql(`CREATE INDEX IF NOT EXISTS idx_runs_dataset_id ON runs(dataset_id)`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_datasets_fingerprint ON datasets(fingerprint)`);

  // ---------------------------------------------------------------------------
  // Stage 2: Extend datasets for synthetic readiness + viewing
  // ---------------------------------------------------------------------------

  await sql(`
    ALTER TABLE datasets
      ADD COLUMN IF NOT EXISTS dataset_role TEXT NOT NULL DEFAULT 'uploaded'
        CHECK (dataset_role IN ('uploaded','training','scoring'))
  `);
  await sql(`
    ALTER TABLE datasets
      ADD COLUMN IF NOT EXISTS generator_config_json JSONB
  `);
  await sql(`
    ALTER TABLE datasets
      ADD COLUMN IF NOT EXISTS label_present BOOLEAN NOT NULL DEFAULT false
  `);

  // ---------------------------------------------------------------------------
  // Stage 2: Model registry
  // ---------------------------------------------------------------------------

  await sql(`
    CREATE TABLE IF NOT EXISTS models (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT        NOT NULL,
      description TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await sql(`
    CREATE TABLE IF NOT EXISTS model_versions (
      id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      model_id              UUID        NOT NULL REFERENCES models(id) ON DELETE CASCADE,

      algorithm             TEXT        NOT NULL,
      hyperparams_json      JSONB       NOT NULL DEFAULT '{}'::jsonb,
      feature_spec_version  TEXT        NOT NULL DEFAULT 'v1',

      trained_dataset_id    UUID        NOT NULL REFERENCES datasets(id) ON DELETE RESTRICT,
      artifact_blob_url     TEXT        NOT NULL,

      metrics_json          JSONB       NOT NULL DEFAULT '{}'::jsonb,
      global_importance_json JSONB      NOT NULL DEFAULT '{}'::jsonb,
      explain_blob_url      TEXT,

      is_champion           BOOLEAN     NOT NULL DEFAULT false,

      created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await sql(`CREATE INDEX IF NOT EXISTS idx_model_versions_model_id ON model_versions(model_id)`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_model_versions_algorithm ON model_versions(algorithm)`);
  await sql(
    `CREATE INDEX IF NOT EXISTS idx_model_versions_is_champion ON model_versions(is_champion)`
  );

  // ---------------------------------------------------------------------------
  // Stage 2: Bake-off orchestration
  // ---------------------------------------------------------------------------

  await sql(`
    CREATE TABLE IF NOT EXISTS bakeoffs (
      id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      model_id              UUID        NOT NULL REFERENCES models(id) ON DELETE CASCADE,
      dataset_id            UUID        NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,

      status                TEXT        NOT NULL CHECK (status IN ('queued','running','completed','failed')),
      rubric_json           JSONB       NOT NULL DEFAULT '{}'::jsonb,

      candidate_version_ids JSONB       NOT NULL DEFAULT '[]'::jsonb,
      champion_version_id   UUID,

      narrative_short       TEXT,
      narrative_long        TEXT,

      started_at            TIMESTAMPTZ,
      completed_at          TIMESTAMPTZ,
      error_json            JSONB,

      created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await sql(`CREATE INDEX IF NOT EXISTS idx_bakeoffs_model_id ON bakeoffs(model_id)`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_bakeoffs_status ON bakeoffs(status)`);
}
