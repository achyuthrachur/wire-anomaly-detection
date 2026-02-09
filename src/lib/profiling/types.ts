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
