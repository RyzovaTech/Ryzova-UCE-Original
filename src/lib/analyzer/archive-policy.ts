const MEBIBYTE = 1024 * 1024;

/** Safety ceiling only; normal large projects are sampled instead of rejected. */
export const MAX_COMPRESSED_ARCHIVE_BYTES = 2 * 1024 * MEBIBYTE;
export const GITHUB_METADATA_TIMEOUT_MS = 30_000;
export const GITHUB_ARCHIVE_TIMEOUT_MS = 10 * 60_000;

/**
 * Large archives need longer to inflate and index. The analyzer still has a
 * finite safety timeout, but it no longer treats every project above 50MB as
 * unsupported.
 */
export function archiveProcessingTimeoutMs(compressedBytes: number): number {
  const sizeInMiB = Math.max(0, compressedBytes) / MEBIBYTE;
  return Math.min(15 * 60_000, Math.max(2 * 60_000, 60_000 + sizeInMiB * 1_500));
}

export function formatArchiveLimit(bytes: number): string {
  return `${Math.round(bytes / MEBIBYTE).toLocaleString()}MB`;
}
