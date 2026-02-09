import { describe, it, expect } from 'vitest';
import { validateDataset } from '@/lib/schema/validation';
import type { ParsedData, InferredSchema } from '@/lib/schema/types';

describe('validateDataset', () => {
  const makeData = (headers: string[], rows: Record<string, string>[]): ParsedData => ({
    headers,
    rows,
    totalRows: rows.length,
  });

  const makeSchema = (columns: Array<{ name: string; type: string }>): InferredSchema => ({
    columns: columns.map((c) => ({
      name: c.name,
      type: c.type as any,
      nullable: false,
      sampleValues: [],
    })),
  });

  it('should detect missing required columns', () => {
    const data = makeData(['Foo', 'Bar'], [{ Foo: '1', Bar: '2' }]);
    const schema = makeSchema([
      { name: 'Foo', type: 'string' },
      { name: 'Bar', type: 'string' },
    ]);
    const result = validateDataset(data, schema);
    expect(result.requiredColumns.missing).toContain('WireID');
    expect(result.requiredColumns.missing).toContain('Amount');
    expect(result.requiredColumns.missing).toContain('WireDate');
  });

  it('should detect present required columns', () => {
    const data = makeData(
      ['WireID', 'Amount', 'WireDate'],
      [{ WireID: '1', Amount: '100', WireDate: '2024-01-01' }]
    );
    const schema = makeSchema([
      { name: 'WireID', type: 'string' },
      { name: 'Amount', type: 'currency' },
      { name: 'WireDate', type: 'date' },
    ]);
    const result = validateDataset(data, schema);
    expect(result.requiredColumns.present).toContain('WireID');
    expect(result.requiredColumns.present).toContain('Amount');
    expect(result.requiredColumns.present).toContain('WireDate');
    expect(result.requiredColumns.missing).toHaveLength(0);
  });

  it('should calculate missingness', () => {
    const data = makeData(
      ['WireID', 'Amount', 'WireDate'],
      [
        { WireID: '1', Amount: '100', WireDate: '2024-01-01' },
        { WireID: '2', Amount: '', WireDate: '2024-01-02' },
        { WireID: '3', Amount: '300', WireDate: '' },
        { WireID: '', Amount: '400', WireDate: '2024-01-04' },
      ]
    );
    const schema = makeSchema([
      { name: 'WireID', type: 'string' },
      { name: 'Amount', type: 'currency' },
      { name: 'WireDate', type: 'date' },
    ]);
    const result = validateDataset(data, schema);
    expect(result.missingness['WireID']).toBe(0.25);
    expect(result.missingness['Amount']).toBe(0.25);
    expect(result.missingness['WireDate']).toBe(0.25);
  });

  it('should detect duplicate WireIDs', () => {
    const data = makeData(
      ['WireID', 'Amount', 'WireDate'],
      [
        { WireID: '1', Amount: '100', WireDate: '2024-01-01' },
        { WireID: '1', Amount: '200', WireDate: '2024-01-02' },
        { WireID: '2', Amount: '300', WireDate: '2024-01-03' },
      ]
    );
    const schema = makeSchema([
      { name: 'WireID', type: 'string' },
      { name: 'Amount', type: 'currency' },
      { name: 'WireDate', type: 'date' },
    ]);
    const result = validateDataset(data, schema);
    expect(result.duplicates['WireID']).toBe(1);
  });
});
