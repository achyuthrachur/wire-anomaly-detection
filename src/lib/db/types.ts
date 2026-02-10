import { z } from 'zod/v4';

// ---------------------------------------------------------------------------
// Column & Schema types
// ---------------------------------------------------------------------------

export type ColumnType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'currency'
  | 'categorical';

export interface InferredColumn {
  name: string;
  type: ColumnType;
  nullable: boolean;
  sampleValues: string[];
}

export interface InferredSchema {
  columns: InferredColumn[];
}

// ---------------------------------------------------------------------------
// Dataset
// ---------------------------------------------------------------------------

export type DatasetRole = 'uploaded' | 'training' | 'scoring';

export interface Dataset {
  id: string;
  name: string;
  source_format: 'csv' | 'xlsx';
  blob_url: string;
  schema_json: InferredSchema;
  row_count: number;
  fingerprint: string;
  dataset_role: DatasetRole;
  generator_config_json: Record<string, unknown> | null;
  label_present: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export interface Run {
  id: string;
  dataset_id: string;
  status: 'created' | 'validated' | 'failed' | 'scoring' | 'scored';
  validation_json: ValidationResult;
  profiling_json: ProfilingResult;
  model_version_id: string | null;
  outputs_blob_url: string | null;
  summary_json: ScoringsSummary;
  created_at: string;
}

export interface ScoringsSummary {
  reviewRate?: number;
  thresholdUsed?: number;
  flaggedCount?: number;
  rowCount?: number;
  metricsIfLabelsPresent?: {
    precision: number;
    recall: number;
    f1: number;
  } | null;
  globalShapTopFeatures?: Array<{ feature: string; meanAbsShap: number }>;
}

export interface RunWithDataset extends Run {
  dataset_name: string;
  source_format: 'csv' | 'xlsx';
  row_count: number;
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface ValidationResult {
  requiredColumns: {
    missing: string[];
    present: string[];
  };
  types: {
    mismatched: Array<{
      column: string;
      expected: string;
      inferred: string;
    }>;
  };
  missingness: Record<string, number>;
  duplicates: Record<string, number>;
  outliers: Record<string, { p99: number; countAboveP99: number }>;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Profiling types
// ---------------------------------------------------------------------------

export interface NumericProfile {
  count: number;
  min: number;
  max: number;
  mean: number;
  std: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface CategoricalProfile {
  count: number;
  unique: number;
  topValues: Array<{ value: string; count: number }>;
}

export interface DateProfile {
  count: number;
  min: string;
  max: string;
  range_days: number;
}

export interface ProfilingResult {
  rowCount: number;
  columnCount: number;
  numeric: Record<string, NumericProfile>;
  categorical: Record<string, CategoricalProfile>;
  date: Record<string, DateProfile>;
}

// ---------------------------------------------------------------------------
// Zod schemas for API request / response validation
// ---------------------------------------------------------------------------

export const UploadResponseSchema = z.object({
  datasetId: z.string(),
  runId: z.string(),
  blobUrl: z.string(),
  schema: z.object({
    columns: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        nullable: z.boolean(),
        sampleValues: z.array(z.string()),
      })
    ),
  }),
});

export const ValidateRequestSchema = z.object({
  datasetId: z.string().uuid(),
  runId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Stage 2: Model Registry
// ---------------------------------------------------------------------------

export interface Model {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface ModelVersion {
  id: string;
  model_id: string;
  algorithm: string;
  hyperparams_json: Record<string, unknown>;
  feature_spec_version: string;
  trained_dataset_id: string;
  artifact_blob_url: string;
  metrics_json: MetricsResult;
  global_importance_json: Record<string, number>;
  explain_blob_url: string | null;
  is_champion: boolean;
  created_at: string;
}

export interface ModelWithChampion extends Model {
  champion_version_id: string | null;
  champion_algorithm: string | null;
  version_count: number;
}

export interface MetricsResult {
  prAuc: number;
  recallAtReviewRate: number;
  precisionAtReviewRate: number;
  f1: number;
  stability: number;
  explainability: number;
}

// ---------------------------------------------------------------------------
// Stage 2: Bake-off
// ---------------------------------------------------------------------------

export type BakeoffStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface Bakeoff {
  id: string;
  model_id: string;
  dataset_id: string;
  status: BakeoffStatus;
  rubric_json: RubricConfig;
  candidate_version_ids: string[];
  champion_version_id: string | null;
  narrative_short: string | null;
  narrative_long: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_json: Record<string, unknown> | null;
  created_at: string;
}

export interface BakeoffWithCandidates extends Bakeoff {
  candidates: ModelVersion[];
  dataset_name: string;
  model_name: string;
}

export interface RubricConfig {
  constraints: {
    minRecallAtReviewRate: number;
    minPrecisionAtReviewRate: number;
  };
  weights: {
    recallAtReviewRate: number;
    prAuc: number;
    precisionAtReviewRate: number;
    stability: number;
    explainability: number;
  };
}

// ---------------------------------------------------------------------------
// Stage 2: Zod schemas for request validation
// ---------------------------------------------------------------------------

export const CreateModelRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const CandidateConfigSchema = z.object({
  algorithm: z.string(),
  hyperparams: z.record(z.string(), z.unknown()).optional(),
});

export const StartBakeoffRequestSchema = z.object({
  datasetId: z.string().uuid(),
  modelId: z.string().uuid(),
  labelColumn: z.string().min(1),
  reviewRate: z.number().min(0.0001).max(1).optional(),
  candidates: z.array(CandidateConfigSchema).min(1),
  rubric: z
    .object({
      constraints: z.object({
        minRecallAtReviewRate: z.number().min(0).max(1),
        minPrecisionAtReviewRate: z.number().min(0).max(1),
      }),
      weights: z.object({
        recallAtReviewRate: z.number(),
        prAuc: z.number(),
        precisionAtReviewRate: z.number(),
        stability: z.number(),
        explainability: z.number(),
      }),
    })
    .optional(),
});

export const SetChampionRequestSchema = z.object({
  modelVersionId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Stage 2: Bake-off progress (stored in error_json during sequential training)
// ---------------------------------------------------------------------------

export interface BakeoffProgress {
  featuresBlobUrl: string;
  candidateConfigs: Array<{ algorithm: string; hyperparams: Record<string, unknown> }>;
  labelColumn: string;
  reviewRate: number;
}

export const TrainCandidateRequestSchema = z.object({
  candidateIndex: z.number().int().min(0),
});

// ---------------------------------------------------------------------------
// Stage 3: Finding
// ---------------------------------------------------------------------------

export interface Finding {
  id: string;
  run_id: string;
  wire_id: string;
  rank: number;
  score: number;
  predicted_label: boolean;
  reason_codes_json: ReasonCodeEntry[];
  local_explain_blob_url: string | null;
  created_at: string;
}

export interface ReasonCodeEntry {
  code: string;
  description: string;
  contribution: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Stage 3: Synthetic Job
// ---------------------------------------------------------------------------

export type SyntheticJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface SyntheticJob {
  id: string;
  status: SyntheticJobStatus;
  config_json: SyntheticConfig;
  training_dataset_id: string | null;
  scoring_dataset_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_json: Record<string, unknown> | null;
  created_at: string;
}

export interface SyntheticConfig {
  seed: number;
  training: {
    nRows: number;
    dateStart: string;
    dateEnd: string;
    anomalyRate: number;
  };
  scoring: {
    nRows: number;
    dateStart: string;
    dateEnd: string;
    anomalyRate: number;
    hideLabelsByDefault: boolean;
  };
  population: {
    initiators: number;
    reviewers: number;
    customers: number;
    beneficiaries: number;
  };
  distributions: {
    amount: { family: string; mu: number; sigma: number };
    wiresPerCustomer: { family: string; mean: number; dispersion: number };
  };
  anomalyMix: {
    highAmount: number;
    burst: number;
    outOfHoursIrregular: number;
    riskCorridorCallbackBypass: number;
    sodException: number;
  };
}

// ---------------------------------------------------------------------------
// Stage 3: Zod schemas for request validation
// ---------------------------------------------------------------------------

export const StartScoringRequestSchema = z.object({
  datasetId: z.string().uuid(),
  modelId: z.string().uuid(),
  modelVersionId: z.string().uuid().nullable().optional(),
  useChampionIfNull: z.boolean().optional().default(true),
  reviewRate: z.number().min(0.0001).max(1).optional(),
  threshold: z.number().min(0).max(1).nullable().optional(),
});

export const StartSyntheticRequestSchema = z.object({
  config: z.object({
    seed: z.number().int(),
    training: z.object({
      nRows: z.number().int().min(100).max(500000),
      dateStart: z.string(),
      dateEnd: z.string(),
      anomalyRate: z.number().min(0).max(1),
    }),
    scoring: z.object({
      nRows: z.number().int().min(100).max(500000),
      dateStart: z.string(),
      dateEnd: z.string(),
      anomalyRate: z.number().min(0).max(1),
      hideLabelsByDefault: z.boolean(),
    }),
    population: z.object({
      initiators: z.number().int().min(1),
      reviewers: z.number().int().min(1),
      customers: z.number().int().min(1),
      beneficiaries: z.number().int().min(1),
    }),
    distributions: z.object({
      amount: z.object({
        family: z.string(),
        mu: z.number(),
        sigma: z.number(),
      }),
      wiresPerCustomer: z.object({
        family: z.string(),
        mean: z.number(),
        dispersion: z.number(),
      }),
    }),
    anomalyMix: z.object({
      highAmount: z.number().min(0).max(1),
      burst: z.number().min(0).max(1),
      outOfHoursIrregular: z.number().min(0).max(1),
      riskCorridorCallbackBypass: z.number().min(0).max(1),
      sodException: z.number().min(0).max(1),
    }),
  }),
  outputFormat: z.enum(['csv', 'xlsx']).optional().default('csv'),
});
