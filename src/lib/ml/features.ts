// ---------------------------------------------------------------------------
// Feature Engineering — builds a numeric feature matrix from raw parsed rows
// ---------------------------------------------------------------------------

import { mean, standardDeviation } from '@/lib/profiling/stats';
import type { FeatureMatrix, NormalizationContext, FeatureMatrixWithNorm } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a string label into 0 or 1 (binary classification). */
function parseLabel(value: string | undefined): number {
  if (value === undefined || value === null || value === '') return 0;
  const v = String(value).trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes') return 1;
  if (v === '0' || v === 'false' || v === 'no') return 0;
  // attempt numeric parse
  const n = Number(v);
  if (!isNaN(n)) return n >= 0.5 ? 1 : 0;
  return 0;
}

/** Parse a numeric string into a number, NaN-safe. */
function parseNumeric(value: string | undefined): number {
  if (value === undefined || value === null || value === '') return NaN;
  // strip currency symbols and commas
  const cleaned = String(value).replace(/[$,\s]/g, '');
  return Number(cleaned);
}

/** Parse a date string into a Date object or null. */
function parseDate(value: string | undefined): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Build a numeric feature matrix from raw parsed rows.
 *
 * When `normContext` is undefined (training mode): compute stats from data and return them.
 * When `normContext` is provided (scoring mode): use saved stats for z-score and category mappings.
 */
export function buildFeatureMatrix(
  rows: Record<string, string>[],
  schema: { columns: Array<{ name: string; type: string }> },
  labelColumn: string,
  normContext?: NormalizationContext
): FeatureMatrixWithNorm {
  if (rows.length === 0) {
    return {
      X: [],
      y: [],
      featureNames: [],
      labelColumn,
      normContext: normContext ?? { numericStats: {}, categoricalMappings: {} },
    };
  }

  // Parse labels
  const y = rows.map((row) => parseLabel(row[labelColumn]));

  // Separate columns by type, excluding the label
  const numericCols: Array<{ name: string; type: string }> = [];
  const categoricalCols: Array<{ name: string; type: string }> = [];
  const dateCols: Array<{ name: string; type: string }> = [];
  const booleanCols: Array<{ name: string; type: string }> = [];

  for (const col of schema.columns) {
    if (col.name === labelColumn) continue;

    switch (col.type) {
      case 'number':
      case 'integer':
      case 'currency':
        numericCols.push(col);
        break;
      case 'string':
      case 'categorical':
        categoricalCols.push(col);
        break;
      case 'date':
        dateCols.push(col);
        break;
      case 'boolean':
        booleanCols.push(col);
        break;
      default:
        categoricalCols.push(col);
        break;
    }
  }

  // Build normalization context if not provided (training mode)
  const builtNumericStats: Record<string, { mean: number; std: number }> = {};
  const builtCategoricalMappings: Record<string, string[]> = {};

  // We build feature columns one by one, then assemble the matrix
  const featureColumns: number[][] = [];
  const featureNames: string[] = [];

  // ---- Numeric columns: z-score normalize ----
  for (const col of numericCols) {
    const rawValues = rows.map((row) => parseNumeric(row[col.name]));

    let mu: number, sigma: number;
    if (normContext?.numericStats[col.name]) {
      mu = normContext.numericStats[col.name].mean;
      sigma = normContext.numericStats[col.name].std;
    } else {
      const validValues = rawValues.filter((v) => !isNaN(v));
      mu = mean(validValues);
      sigma = standardDeviation(validValues);
    }
    builtNumericStats[col.name] = { mean: mu, std: sigma };

    const normalized = rawValues.map((v) => {
      if (isNaN(v)) return 0;
      if (sigma === 0) return 0;
      return (v - mu) / sigma;
    });

    featureColumns.push(normalized);
    featureNames.push(col.name);
  }

  // ---- Special derived features for Amount-like columns ----
  for (const col of numericCols) {
    const lowerName = col.name.toLowerCase();
    if (lowerName === 'amount' || lowerName.includes('amount')) {
      const rawValues = rows.map((row) => parseNumeric(row[col.name]));
      const zScoreKey = `${col.name}_zScore`;
      const logKey = `${col.name}_log`;

      let mu: number, sigma: number;
      if (normContext?.numericStats[zScoreKey]) {
        mu = normContext.numericStats[zScoreKey].mean;
        sigma = normContext.numericStats[zScoreKey].std;
      } else {
        const validValues = rawValues.filter((v) => !isNaN(v));
        mu = mean(validValues);
        sigma = standardDeviation(validValues);
      }
      builtNumericStats[zScoreKey] = { mean: mu, std: sigma };

      const zScores = rawValues.map((v) => {
        if (isNaN(v)) return 0;
        if (sigma === 0) return 0;
        return (v - mu) / sigma;
      });

      const logAmounts = rawValues.map((v) => {
        if (isNaN(v) || v < 0) return 0;
        return Math.log(v + 1);
      });

      featureColumns.push(zScores);
      featureNames.push(zScoreKey);
      featureColumns.push(logAmounts);
      featureNames.push(logKey);
    }
  }

  // ---- Categorical columns: one-hot encode ----
  for (const col of categoricalCols) {
    let topValues: string[];

    if (normContext?.categoricalMappings[col.name]) {
      // Scoring mode: use training-time categories
      topValues = normContext.categoricalMappings[col.name];
    } else {
      // Training mode: determine top 10
      const freq: Record<string, number> = {};
      for (const row of rows) {
        const v = String(row[col.name] ?? '').trim();
        if (v === '') continue;
        freq[v] = (freq[v] || 0) + 1;
      }
      topValues = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value]) => value);
    }
    builtCategoricalMappings[col.name] = topValues;

    for (const topValue of topValues) {
      const encoded = rows.map((row) => {
        const v = String(row[col.name] ?? '').trim();
        return v === topValue ? 1 : 0;
      });
      featureColumns.push(encoded);
      featureNames.push(`${col.name}_${topValue}`);
    }
  }

  // ---- Date columns: extract temporal features ----
  for (const col of dateCols) {
    const hourOfDay: number[] = [];
    const dayOfWeek: number[] = [];
    const isWeekend: number[] = [];
    const isOutOfHours: number[] = [];
    const isExtendedHours: number[] = [];

    for (const row of rows) {
      const d = parseDate(row[col.name]);
      if (d) {
        const hour = d.getHours();
        const dow = d.getDay();
        hourOfDay.push(hour);
        dayOfWeek.push(dow);
        isWeekend.push(dow === 0 || dow === 6 ? 1 : 0);
        // Deep night only: before 6am or 10pm+
        isOutOfHours.push(hour < 6 || hour >= 22 ? 1 : 0);
        // Twilight zone: 6-8am or 5-10pm
        isExtendedHours.push((hour >= 6 && hour < 8) || (hour >= 17 && hour < 22) ? 1 : 0);
      } else {
        hourOfDay.push(0);
        dayOfWeek.push(0);
        isWeekend.push(0);
        isOutOfHours.push(0);
        isExtendedHours.push(0);
      }
    }

    featureColumns.push(hourOfDay);
    featureNames.push(`${col.name}_hourOfDay`);
    featureColumns.push(dayOfWeek);
    featureNames.push(`${col.name}_dayOfWeek`);
    featureColumns.push(isWeekend);
    featureNames.push(`${col.name}_isWeekend`);
    featureColumns.push(isOutOfHours);
    featureNames.push(`${col.name}_isOutOfHours`);
    featureColumns.push(isExtendedHours);
    featureNames.push(`${col.name}_isExtendedHours`);
  }

  // ---- Boolean columns: 0/1 ----
  for (const col of booleanCols) {
    const encoded = rows.map((row) => {
      const v = String(row[col.name] ?? '')
        .trim()
        .toLowerCase();
      if (v === '1' || v === 'true' || v === 'yes') return 1;
      return 0;
    });
    featureColumns.push(encoded);
    featureNames.push(col.name);
  }

  // ---- Assemble matrix: transpose columns into rows ----
  const nSamples = rows.length;
  const nFeatures = featureColumns.length;
  const X: number[][] = new Array(nSamples);

  for (let i = 0; i < nSamples; i++) {
    X[i] = new Array(nFeatures);
    for (let j = 0; j < nFeatures; j++) {
      X[i][j] = featureColumns[j][i];
    }
  }

  return {
    X,
    y,
    featureNames,
    labelColumn,
    normContext: normContext ?? {
      numericStats: builtNumericStats,
      categoricalMappings: builtCategoricalMappings,
    },
  };
}
