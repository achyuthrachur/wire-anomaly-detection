import type { ParsedData, InferredSchema } from './types';
import type { ValidationResult } from '../db/types';
import { REQUIRED_COLUMNS, matchRequiredColumn } from './requiredColumns';

export function validateDataset(
  data: ParsedData,
  schema: InferredSchema
): ValidationResult {
  const result: ValidationResult = {
    requiredColumns: { missing: [], present: [] },
    types: { mismatched: [] },
    missingness: {},
    duplicates: {},
    outliers: {},
    notes: [],
  };

  // 1. Required column checks
  const headerMatches = new Map<string, string>();
  for (const header of data.headers) {
    const match = matchRequiredColumn(header);
    if (match) {
      headerMatches.set(match.name, header);
    }
  }

  for (const col of REQUIRED_COLUMNS) {
    if (headerMatches.has(col.name)) {
      result.requiredColumns.present.push(col.name);
    } else if (col.required) {
      result.requiredColumns.missing.push(col.name);
      result.notes.push(
        `Missing required column: ${col.name}. Expected a column matching one of: ${col.aliases.join(', ')}`
      );
    }
  }

  // 2. Type mismatch checks
  for (const [reqName, actualHeader] of headerMatches) {
    const reqCol = REQUIRED_COLUMNS.find((c) => c.name === reqName);
    const schemaCol = schema.columns.find((c) => c.name === actualHeader);
    if (reqCol && schemaCol) {
      const expected = reqCol.type;
      const inferred = schemaCol.type;
      if (!isTypeCompatible(expected, inferred)) {
        result.types.mismatched.push({ column: actualHeader, expected, inferred });
        result.notes.push(
          `Type mismatch on "${actualHeader}": expected ${expected}, found ${inferred}`
        );
      }
    }
  }

  // 3. Missingness per column
  for (const header of data.headers) {
    const total = data.rows.length;
    const missing = data.rows.filter((row) => {
      const val = row[header];
      return val === undefined || val === null || val.toString().trim() === '';
    }).length;
    result.missingness[header] = total > 0 ? Number((missing / total).toFixed(4)) : 0;
  }

  // 4. Duplicate detection (WireID)
  const wireIdHeader = headerMatches.get('WireID');
  if (wireIdHeader) {
    const counts = new Map<string, number>();
    for (const row of data.rows) {
      const val = (row[wireIdHeader] ?? '').trim();
      if (val) counts.set(val, (counts.get(val) ?? 0) + 1);
    }
    const dupCount = Array.from(counts.values()).filter((c) => c > 1).length;
    if (dupCount > 0) {
      result.duplicates[wireIdHeader] = dupCount;
      result.notes.push(`Found ${dupCount} duplicate values in ${wireIdHeader}`);
    }
  }

  // 5. Outlier detection for Amount
  const amountHeader = headerMatches.get('Amount');
  if (amountHeader) {
    const values = data.rows
      .map((row) => parseFloat((row[amountHeader] ?? '').replace(/[$,]/g, '')))
      .filter((v) => !isNaN(v));

    if (values.length > 0) {
      values.sort((a, b) => a - b);
      const p99Index = Math.floor(values.length * 0.99);
      const p99 = values[p99Index] ?? values[values.length - 1];
      const countAboveP99 = values.filter((v) => v > p99).length;

      result.outliers[amountHeader] = {
        p99: Number(p99.toFixed(2)),
        countAboveP99,
      };

      if (countAboveP99 > 0) {
        result.notes.push(
          `${countAboveP99} values in ${amountHeader} exceed the p99 threshold ($${p99.toFixed(2)})`
        );
      }
    }
  }

  // Summary
  if (result.requiredColumns.missing.length > 0) {
    result.notes.unshift(
      `Validation failed: ${result.requiredColumns.missing.length} required column(s) missing`
    );
  } else if (result.types.mismatched.length === 0) {
    result.notes.push('All required columns present and type-compatible');
  }

  return result;
}

function isTypeCompatible(expected: string, inferred: string): boolean {
  if (expected === inferred) return true;
  if (expected === 'number' && ['number', 'integer', 'currency'].includes(inferred)) return true;
  if (expected === 'string') return true;
  return false;
}
