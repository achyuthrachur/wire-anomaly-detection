import type { ColumnType, InferredColumn, InferredSchema, ParsedData } from './types';

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // M/D/YYYY or MM/DD/YY
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO 8601
  /^\w{3}\s+\d{1,2},?\s+\d{4}$/, // Mon DD, YYYY
  /^\d{1,2}-\w{3}-\d{2,4}$/, // DD-Mon-YY
];

const CURRENCY_NAME_PATTERNS =
  /amount|price|cost|fee|balance|total|payment|credit|debit|value/i;

/** Infer schema from parsed data */
export function inferSchema(data: ParsedData): InferredSchema {
  const columns: InferredColumn[] = data.headers.map((header) => {
    const values = data.rows.map((row) => row[header] ?? '');
    const nonEmpty = values.filter((v) => v.trim() !== '');
    const sampleValues = nonEmpty.slice(0, 5);

    if (nonEmpty.length === 0) {
      return {
        name: header,
        type: 'string' as ColumnType,
        nullable: true,
        sampleValues: [],
      };
    }

    const type = inferColumnType(header, nonEmpty);
    const nullable = nonEmpty.length < values.length;

    return { name: header, type, nullable, sampleValues };
  });

  return { columns };
}

function inferColumnType(header: string, values: string[]): ColumnType {
  const total = values.length;

  // Check for date (>90% parse success)
  const dateCount = values.filter(isDate).length;
  if (dateCount / total > 0.9) return 'date';

  // Check for number/integer (>95% parse success)
  const numericValues = values.map(parseNumeric);
  const numericCount = numericValues.filter((v) => v !== null).length;

  if (numericCount / total > 0.95) {
    // Check if it's currency by column name
    if (CURRENCY_NAME_PATTERNS.test(header)) return 'currency';

    // Check if all parsed values are integers
    const allIntegers = numericValues
      .filter((v): v is number => v !== null)
      .every((v) => Number.isInteger(v));
    return allIntegers ? 'integer' : 'number';
  }

  // Check for boolean
  const boolCount = values.filter(isBoolean).length;
  if (boolCount / total > 0.95) return 'boolean';

  // Check for categorical (unique ratio < 0.2 AND not numeric/date)
  const uniqueValues = new Set(values.map((v) => v.toLowerCase().trim()));
  const uniqueRatio = uniqueValues.size / total;
  if (uniqueRatio < 0.2 && total >= 10) return 'categorical';

  return 'string';
}

function isDate(value: string): boolean {
  const trimmed = value.trim();
  if (DATE_PATTERNS.some((p) => p.test(trimmed))) return true;
  // Try native Date parsing as fallback
  const d = new Date(trimmed);
  return !isNaN(d.getTime()) && trimmed.length > 4;
}

function parseNumeric(value: string): number | null {
  const cleaned = value
    .trim()
    .replace(/[$,\u20AC\u00A3\u00A5]/g, '')
    .replace(/\((.+)\)/, '-$1');
  if (cleaned === '' || cleaned === '-') return null;
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

function isBoolean(value: string): boolean {
  const v = value.toLowerCase().trim();
  return ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(v);
}
