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

export interface Dataset {
  id: string;
  name: string;
  source_format: 'csv' | 'xlsx';
  blob_url: string;
  schema_json: InferredSchema;
  row_count: number;
  fingerprint: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export interface Run {
  id: string;
  dataset_id: string;
  status: 'created' | 'validated' | 'failed';
  validation_json: ValidationResult;
  profiling_json: ProfilingResult;
  created_at: string;
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
