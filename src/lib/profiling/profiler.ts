import type { ParsedData, InferredSchema } from '../schema/types';
import type { ProfilingResult, NumericProfile, CategoricalProfile, DateProfile } from './types';
import { mean, standardDeviation, percentile } from './stats';

export function profileDataset(data: ParsedData, schema: InferredSchema): ProfilingResult {
  const result: ProfilingResult = {
    rowCount: data.rows.length,
    columnCount: data.headers.length,
    numeric: {},
    categorical: {},
    date: {},
  };

  for (const col of schema.columns) {
    const values = data.rows.map((row) => row[col.name] ?? '');

    switch (col.type) {
      case 'number':
      case 'integer':
      case 'currency':
        result.numeric[col.name] = profileNumeric(values);
        break;
      case 'categorical':
        result.categorical[col.name] = profileCategorical(values);
        break;
      case 'date':
        result.date[col.name] = profileDate(values);
        break;
      case 'string': {
        const unique = new Set(values.filter((v) => v.trim() !== ''));
        if (unique.size > 0 && unique.size / values.length < 0.5) {
          result.categorical[col.name] = profileCategorical(values);
        }
        break;
      }
    }
  }

  return result;
}

function profileNumeric(rawValues: string[]): NumericProfile {
  const values = rawValues
    .map((v) => parseFloat(v.replace(/[$,€£¥]/g, '').replace(/\((.+)\)/, '-$1')))
    .filter((v) => !isNaN(v));

  if (values.length === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, std: 0, p50: 0, p95: 0, p99: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);

  return {
    count: values.length,
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
    mean: round(mean(values)),
    std: round(standardDeviation(values)),
    p50: round(percentile(sorted, 50)),
    p95: round(percentile(sorted, 95)),
    p99: round(percentile(sorted, 99)),
  };
}

function profileCategorical(rawValues: string[]): CategoricalProfile {
  const values = rawValues.filter((v) => v.trim() !== '');
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const topValues = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([value, count]) => ({ value, count }));

  return {
    count: values.length,
    unique: counts.size,
    topValues,
  };
}

function profileDate(rawValues: string[]): DateProfile {
  const dates = rawValues
    .map((v) => new Date(v.trim()))
    .filter((d) => !isNaN(d.getTime()));

  if (dates.length === 0) {
    return { count: 0, min: '', max: '', range_days: 0 };
  }

  const timestamps = dates.map((d) => d.getTime());
  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);
  const rangeDays = Math.round((maxTs - minTs) / (1000 * 60 * 60 * 24));

  return {
    count: dates.length,
    min: new Date(minTs).toISOString().split('T')[0],
    max: new Date(maxTs).toISOString().split('T')[0],
    range_days: rangeDays,
  };
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}
