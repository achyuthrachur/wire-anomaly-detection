import { sql } from './client';
import type {
  Dataset,
  DatasetRole,
  Run,
  RunWithDataset,
  Model,
  ModelVersion,
  ModelWithChampion,
  Bakeoff,
  BakeoffWithCandidates,
  BakeoffStatus,
  MetricsResult,
  RubricConfig,
} from './types';

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

export async function insertDataset(
  dataset: Omit<
    Dataset,
    'id' | 'created_at' | 'dataset_role' | 'generator_config_json' | 'label_present'
  > & {
    dataset_role?: Dataset['dataset_role'];
    generator_config_json?: Dataset['generator_config_json'];
    label_present?: boolean;
  }
): Promise<Dataset> {
  const rows = await sql(
    `
    INSERT INTO datasets (name, source_format, blob_url, schema_json, row_count, fingerprint, dataset_role, generator_config_json, label_present)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
    `,
    [
      dataset.name,
      dataset.source_format,
      dataset.blob_url,
      JSON.stringify(dataset.schema_json),
      dataset.row_count,
      dataset.fingerprint,
      dataset.dataset_role ?? 'uploaded',
      dataset.generator_config_json ? JSON.stringify(dataset.generator_config_json) : null,
      dataset.label_present ?? false,
    ]
  );
  return rows[0] as unknown as Dataset;
}

export async function findDatasetByFingerprint(fingerprint: string): Promise<Dataset | null> {
  const rows = await sql(`SELECT * FROM datasets WHERE fingerprint = $1 LIMIT 1`, [fingerprint]);
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
    [datasetId]
  );
  return rows[0] as unknown as Run;
}

export async function updateRunStatus(
  runId: string,
  status: Run['status'],
  validationJson: unknown,
  profilingJson: unknown
): Promise<Run> {
  const rows = await sql(
    `
    UPDATE runs
    SET status = $1, validation_json = $2, profiling_json = $3
    WHERE id = $4
    RETURNING *
    `,
    [status, JSON.stringify(validationJson), JSON.stringify(profilingJson), runId]
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
  runId: string
): Promise<(RunWithDataset & { blob_url: string; schema_json: unknown }) | null> {
  const rows = await sql(
    `
    SELECT r.*, d.name AS dataset_name, d.source_format, d.row_count,
           d.blob_url, d.schema_json
    FROM runs r
    JOIN datasets d ON r.dataset_id = d.id
    WHERE r.id = $1
    `,
    [runId]
  );
  return (
    (rows[0] as unknown as RunWithDataset & {
      blob_url: string;
      schema_json: unknown;
    }) ?? null
  );
}

// ---------------------------------------------------------------------------
// Stage 2: Datasets (extended)
// ---------------------------------------------------------------------------

export async function listDatasets(role?: DatasetRole): Promise<Dataset[]> {
  if (role) {
    const rows = await sql(
      `SELECT * FROM datasets WHERE dataset_role = $1 ORDER BY created_at DESC`,
      [role]
    );
    return rows as unknown as Dataset[];
  }
  const rows = await sql(`SELECT * FROM datasets ORDER BY created_at DESC`);
  return rows as unknown as Dataset[];
}

export async function getDatasetByIdFull(
  id: string
): Promise<{ dataset: Dataset; latestRun: Run | null } | null> {
  const datasetRows = await sql(`SELECT * FROM datasets WHERE id = $1`, [id]);
  if (!datasetRows[0]) return null;
  const dataset = datasetRows[0] as unknown as Dataset;

  const runRows = await sql(
    `SELECT * FROM runs WHERE dataset_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [id]
  );
  const latestRun = (runRows[0] as unknown as Run) ?? null;

  return { dataset, latestRun };
}

export async function updateDatasetLabelPresent(id: string, labelPresent: boolean): Promise<void> {
  await sql(`UPDATE datasets SET label_present = $1 WHERE id = $2`, [labelPresent, id]);
}

// ---------------------------------------------------------------------------
// Stage 2: Models
// ---------------------------------------------------------------------------

export async function insertModel(name: string, description?: string): Promise<Model> {
  const rows = await sql(`INSERT INTO models (name, description) VALUES ($1, $2) RETURNING *`, [
    name,
    description ?? null,
  ]);
  return rows[0] as unknown as Model;
}

export async function listModels(): Promise<ModelWithChampion[]> {
  const rows = await sql(`
    SELECT
      m.*,
      cv.id AS champion_version_id,
      cv.algorithm AS champion_algorithm,
      COALESCE(vc.cnt, 0)::int AS version_count
    FROM models m
    LEFT JOIN model_versions cv ON cv.model_id = m.id AND cv.is_champion = true
    LEFT JOIN (
      SELECT model_id, COUNT(*)::int AS cnt FROM model_versions GROUP BY model_id
    ) vc ON vc.model_id = m.id
    ORDER BY m.created_at DESC
  `);
  return rows as unknown as ModelWithChampion[];
}

export async function getModelById(id: string): Promise<Model | null> {
  const rows = await sql(`SELECT * FROM models WHERE id = $1`, [id]);
  return (rows[0] as unknown as Model) ?? null;
}

export async function setChampionVersion(modelId: string, versionId: string): Promise<void> {
  await sql(`UPDATE model_versions SET is_champion = false WHERE model_id = $1`, [modelId]);
  await sql(`UPDATE model_versions SET is_champion = true WHERE id = $1 AND model_id = $2`, [
    versionId,
    modelId,
  ]);
}

// ---------------------------------------------------------------------------
// Stage 2: Model Versions
// ---------------------------------------------------------------------------

export async function insertModelVersion(
  version: Omit<ModelVersion, 'id' | 'created_at'>
): Promise<ModelVersion> {
  const rows = await sql(
    `
    INSERT INTO model_versions (
      model_id, algorithm, hyperparams_json, feature_spec_version,
      trained_dataset_id, artifact_blob_url,
      metrics_json, global_importance_json, explain_blob_url, is_champion
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
    `,
    [
      version.model_id,
      version.algorithm,
      JSON.stringify(version.hyperparams_json),
      version.feature_spec_version,
      version.trained_dataset_id,
      version.artifact_blob_url,
      JSON.stringify(version.metrics_json),
      JSON.stringify(version.global_importance_json),
      version.explain_blob_url,
      version.is_champion,
    ]
  );
  return rows[0] as unknown as ModelVersion;
}

export async function listModelVersionsByModelId(modelId: string): Promise<ModelVersion[]> {
  const rows = await sql(
    `SELECT * FROM model_versions WHERE model_id = $1 ORDER BY created_at DESC`,
    [modelId]
  );
  return rows as unknown as ModelVersion[];
}

export async function getModelVersionById(id: string): Promise<ModelVersion | null> {
  const rows = await sql(`SELECT * FROM model_versions WHERE id = $1`, [id]);
  return (rows[0] as unknown as ModelVersion) ?? null;
}

// ---------------------------------------------------------------------------
// Stage 2: Bakeoffs
// ---------------------------------------------------------------------------

export async function insertBakeoff(
  modelId: string,
  datasetId: string,
  rubric: RubricConfig
): Promise<Bakeoff> {
  const rows = await sql(
    `
    INSERT INTO bakeoffs (model_id, dataset_id, status, rubric_json)
    VALUES ($1, $2, 'queued', $3)
    RETURNING *
    `,
    [modelId, datasetId, JSON.stringify(rubric)]
  );
  return rows[0] as unknown as Bakeoff;
}

export async function getBakeoffById(id: string): Promise<BakeoffWithCandidates | null> {
  const bakeoffRows = await sql(`SELECT * FROM bakeoffs WHERE id = $1`, [id]);
  if (!bakeoffRows[0]) return null;
  const bakeoff = bakeoffRows[0] as unknown as Bakeoff;

  const versionIds = bakeoff.candidate_version_ids;
  let candidates: ModelVersion[] = [];
  if (versionIds.length > 0) {
    const placeholders = versionIds.map((_, i) => `$${i + 1}`).join(',');
    const vRows = await sql(
      `SELECT * FROM model_versions WHERE id IN (${placeholders}) ORDER BY created_at ASC`,
      versionIds
    );
    candidates = vRows as unknown as ModelVersion[];
  }

  const datasetRows = await sql(`SELECT name FROM datasets WHERE id = $1`, [bakeoff.dataset_id]);
  const modelRows = await sql(`SELECT name FROM models WHERE id = $1`, [bakeoff.model_id]);

  return {
    ...bakeoff,
    candidates,
    dataset_name: (datasetRows[0]?.name as string) ?? '',
    model_name: (modelRows[0]?.name as string) ?? '',
  };
}

export async function updateBakeoffStatus(
  id: string,
  status: BakeoffStatus,
  extra?: {
    candidateVersionIds?: string[];
    championVersionId?: string;
    narrativeShort?: string;
    narrativeLong?: string;
    errorJson?: Record<string, unknown>;
  }
): Promise<void> {
  const sets: string[] = ['status = $1'];
  const params: unknown[] = [status];
  let idx = 2;

  if (status === 'running') {
    sets.push(`started_at = now()`);
  }
  if (status === 'completed' || status === 'failed') {
    sets.push(`completed_at = now()`);
  }
  if (extra?.candidateVersionIds) {
    sets.push(`candidate_version_ids = $${idx}`);
    params.push(JSON.stringify(extra.candidateVersionIds));
    idx++;
  }
  if (extra?.championVersionId) {
    sets.push(`champion_version_id = $${idx}`);
    params.push(extra.championVersionId);
    idx++;
  }
  if (extra?.narrativeShort !== undefined) {
    sets.push(`narrative_short = $${idx}`);
    params.push(extra.narrativeShort);
    idx++;
  }
  if (extra?.narrativeLong !== undefined) {
    sets.push(`narrative_long = $${idx}`);
    params.push(extra.narrativeLong);
    idx++;
  }
  if (extra?.errorJson) {
    sets.push(`error_json = $${idx}`);
    params.push(JSON.stringify(extra.errorJson));
    idx++;
  }

  params.push(id);
  await sql(`UPDATE bakeoffs SET ${sets.join(', ')} WHERE id = $${idx}`, params);
}

export async function listBakeoffsByModelId(modelId: string): Promise<Bakeoff[]> {
  const rows = await sql(`SELECT * FROM bakeoffs WHERE model_id = $1 ORDER BY created_at DESC`, [
    modelId,
  ]);
  return rows as unknown as Bakeoff[];
}
