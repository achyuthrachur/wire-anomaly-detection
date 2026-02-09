import { createHash } from 'crypto';

/**
 * Compute a SHA-256 fingerprint for a dataset based on its schema, file size,
 * and row count.  Used for deduplication -- if two uploads produce the same
 * fingerprint we can skip re-processing.
 */
export function computeFingerprint(
  schemaJson: string,
  fileSize: number,
  rowCount: number,
): string {
  const data = `${schemaJson}:${fileSize}:${rowCount}`;
  return createHash('sha256').update(data).digest('hex');
}
