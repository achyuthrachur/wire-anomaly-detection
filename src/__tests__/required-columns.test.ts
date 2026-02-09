import { describe, it, expect } from 'vitest';
import { matchRequiredColumn } from '@/lib/schema/requiredColumns';

describe('matchRequiredColumn', () => {
  it('should match WireID variations', () => {
    expect(matchRequiredColumn('WireID')?.name).toBe('WireID');
    expect(matchRequiredColumn('wire_id')?.name).toBe('WireID');
    expect(matchRequiredColumn('transaction_id')?.name).toBe('WireID');
  });

  it('should match Amount variations', () => {
    expect(matchRequiredColumn('Amount')?.name).toBe('Amount');
    expect(matchRequiredColumn('wire_amount')?.name).toBe('Amount');
    expect(matchRequiredColumn('transaction_amount')?.name).toBe('Amount');
  });

  it('should match WireDate variations', () => {
    expect(matchRequiredColumn('WireDate')?.name).toBe('WireDate');
    expect(matchRequiredColumn('wire_date')?.name).toBe('WireDate');
    expect(matchRequiredColumn('transaction_date')?.name).toBe('WireDate');
  });

  it('should return null for unrecognized columns', () => {
    expect(matchRequiredColumn('FooBar')).toBeNull();
    expect(matchRequiredColumn('random_col')).toBeNull();
  });

  it('should be case-insensitive', () => {
    expect(matchRequiredColumn('WIREID')?.name).toBe('WireID');
    expect(matchRequiredColumn('amount')?.name).toBe('Amount');
  });
});
