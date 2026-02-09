import { put, del } from '@vercel/blob';

/**
 * Upload a dataset file to Vercel Blob storage.
 *
 * @returns The public URL of the stored blob.
 */
export async function uploadDatasetFile(
  filename: string,
  file: Buffer | ReadableStream | Blob,
): Promise<string> {
  const blob = await put(`datasets/${filename}`, file, {
    access: 'public',
    addRandomSuffix: true,
  });
  return blob.url;
}

/**
 * Download a dataset file from Vercel Blob storage.
 *
 * @returns The raw file content as an ArrayBuffer.
 */
export async function downloadDatasetFile(
  blobUrl: string,
): Promise<ArrayBuffer> {
  const response = await fetch(blobUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  return response.arrayBuffer();
}

/**
 * Delete a blob by URL (cleanup helper).
 */
export async function deleteDatasetFile(blobUrl: string): Promise<void> {
  await del(blobUrl);
}
