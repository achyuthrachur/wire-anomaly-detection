import { describe, it, expect } from 'vitest';
import { computeFingerprint } from '@/lib/utils/crypto';

describe('computeFingerprint', () => {
  it('should produce deterministic fingerprints', () => {
    const fp1 = computeFingerprint('{"columns":[]}', 1024, 100);
    const fp2 = computeFingerprint('{"columns":[]}', 1024, 100);
    expect(fp1).toBe(fp2);
  });

  it('should produce different fingerprints for different inputs', () => {
    const fp1 = computeFingerprint('{"columns":[]}', 1024, 100);
    const fp2 = computeFingerprint('{"columns":[]}', 2048, 100);
    expect(fp1).not.toBe(fp2);
  });

  it('should return a valid hex sha256 hash', () => {
    const fp = computeFingerprint('test', 100, 50);
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });
});
