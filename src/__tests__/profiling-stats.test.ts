import { describe, it, expect } from 'vitest';
import { mean, standardDeviation, percentile } from '@/lib/profiling/stats';

describe('mean', () => {
  it('should calculate mean correctly', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it('should return 0 for empty array', () => {
    expect(mean([])).toBe(0);
  });

  it('should handle single value', () => {
    expect(mean([42])).toBe(42);
  });
});

describe('standardDeviation', () => {
  it('should calculate std dev correctly', () => {
    const result = standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result).toBeCloseTo(2.138, 2);
  });

  it('should return 0 for single value', () => {
    expect(standardDeviation([42])).toBe(0);
  });

  it('should return 0 for empty array', () => {
    expect(standardDeviation([])).toBe(0);
  });
});

describe('percentile', () => {
  it('should calculate p50 (median) correctly', () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentile(sorted, 50)).toBe(3);
  });

  it('should calculate p95 correctly', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(sorted, 95)).toBeCloseTo(95.05, 1);
  });

  it('should return 0 for empty array', () => {
    expect(percentile([], 50)).toBe(0);
  });

  it('should handle single value', () => {
    expect(percentile([42], 50)).toBe(42);
  });
});
