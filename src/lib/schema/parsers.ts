import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ParsedData } from './types';

const DEFAULT_SAMPLE_SIZE = 5000;

/** Parse CSV from Buffer. If preview=true, only parse up to sampleSize rows. */
export function parseCSV(
  buffer: Buffer,
  options: { preview?: boolean; sampleSize?: number } = {}
): ParsedData {
  const text = buffer.toString('utf-8');
  const sampleSize = options.sampleSize ?? DEFAULT_SAMPLE_SIZE;

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    preview: options.preview ? sampleSize : undefined,
    dynamicTyping: false, // Keep everything as strings for inference
  });

  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
    totalRows: options.preview ? estimateCSVRows(text) : result.data.length,
  };
}

/** Parse XLSX from Buffer */
export function parseXLSX(
  buffer: Buffer,
  options: { preview?: boolean; sampleSize?: number } = {}
): ParsedData {
  const sampleSize = options.sampleSize ?? DEFAULT_SAMPLE_SIZE;
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Get range to determine total rows
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const totalRows = range.e.r; // 0-indexed, header is row 0

  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    raw: false, // Convert to strings
    defval: '',
  });

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const slicedRows = options.preview ? rows.slice(0, sampleSize) : rows;

  return {
    headers,
    rows: slicedRows,
    totalRows,
  };
}

/** Unified parser that detects format */
export function parseFile(
  buffer: Buffer,
  format: 'csv' | 'xlsx',
  options: { preview?: boolean; sampleSize?: number } = {}
): ParsedData {
  if (format === 'csv') return parseCSV(buffer, options);
  return parseXLSX(buffer, options);
}

/** Quick row estimate for CSV by counting newlines */
function estimateCSVRows(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') count++;
  }
  return Math.max(0, count - 1); // Subtract header
}
