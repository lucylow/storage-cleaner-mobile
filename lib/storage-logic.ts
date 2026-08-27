export type NormalizedStorage = { totalBytes: number; freeBytes: number; usedBytes: number; percentUsed: number };

export function canApplyStorageRefresh(requestId: number, latestRequestId: number, mounted: boolean): boolean {
  return mounted && Number.isInteger(requestId) && requestId === latestRequestId;
}

export function getGuidePersistenceFailureMessage(): string {
  return "The cleanup guide preference could not be saved locally. Your files were not affected.";
}

export function normalizeStorageInfo(totalBytes: number, freeBytes: number): NormalizedStorage | null {
  if (!Number.isFinite(totalBytes) || !Number.isFinite(freeBytes) || totalBytes <= 0 || freeBytes < 0) return null;
  const safeFree = Math.min(freeBytes, totalBytes);
  const usedBytes = Math.max(totalBytes - safeFree, 0);
  return { totalBytes, freeBytes: safeFree, usedBytes, percentUsed: Math.round((usedBytes / totalBytes) * 100) };
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unavailable";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
