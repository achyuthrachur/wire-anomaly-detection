import { describe, it, expect } from 'vitest';
import { inferSchema } from '@/lib/schema/inference';
import type { ParsedData } from '@/lib/schema/types';

describe('inferSchema', () => {
  it('should infer numeric columns', () => {
    const data: ParsedData = {
      headers: ['Count'],
      rows: Array.from({ length: 100 }, (_, i) => ({ Count: String(i * 100) })),
      totalRows: 100,
    };
    const schema = inferSchema(data);
    expect(schema.columns).toHaveLength(1);
    expect(schema.columns[0].type).toBe('integer');
  });

  it('should infer date columns', () => {
    const data: ParsedData = {
      headers: ['WireDate'],
      rows: Array.from({ length: 100 }, (_, i) => ({
        WireDate: `2024-01-${String(i % 28 + 1).padStart(2, '0')}`,
      })),
      totalRows: 100,
    };
    const schema = inferSchema(data);
    expect(schema.columns[0].type).toBe('date');
  });

  it('should infer categorical columns with low cardinality', () => {
    const categories = ['Wire', 'ACH', 'Check'];
    const data: ParsedData = {
      headers: ['Type'],
      rows: Array.from({ length: 100 }, (_, i) => ({
        Type: categories[i % categories.length],
      })),
      totalRows: 100,
    };
    const schema = inferSchema(data);
    expect(schema.columns[0].type).toBe('categorical');
  });

  it('should infer currency columns by name pattern', () => {
    const data: ParsedData = {
      headers: ['Amount'],
      rows: Array.from({ length: 100 }, (_, i) => ({
        Amount: String((i + 1) * 50.5),
      })),
      totalRows: 100,
    };
    const schema = inferSchema(data);
    expect(schema.columns[0].type).toBe('currency');
  });

  it('should detect nullable columns', () => {
    const data: ParsedData = {
      headers: ['Value'],
      rows: [
        { Value: '100' },
        { Value: '' },
        { Value: '200' },
        { Value: '' },
      ],
      totalRows: 4,
    };
    const schema = inferSchema(data);
    expect(schema.columns[0].nullable).toBe(true);
  });

  it('should handle empty datasets', () => {
    const data: ParsedData = {
      headers: ['A', 'B'],
      rows: [],
      totalRows: 0,
    };
    const schema = inferSchema(data);
    expect(schema.columns).toHaveLength(2);
    expect(schema.columns[0].type).toBe('string');
  });
});
