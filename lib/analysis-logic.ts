import type { CleanupCategory, CleanupItem } from "./cleaner-store";

function formatSummaryStorage(value: number) {
  return value >= 1024 ? `${(value / 1024).toFixed(1)} GB` : `${Number(value.toFixed(1))} MB`;
}

export type AnalysisRecord = { id: string; name: string; size: number; signature: string };
export type CategorySummary = { category: CleanupCategory; itemCount: number; reclaimableBytes: number; selectedBytes: number };

export function groupDuplicateCandidates(records: AnalysisRecord[]) {
  const groups = new Map<string, AnalysisRecord[]>();
  for (const record of records) groups.set(record.signature, [...(groups.get(record.signature) ?? []), record]);
  return [...groups.values()].filter((group) => group.length > 1);
}

export function bucketLargeFiles(records: AnalysisRecord[], threshold = 500) {
  return records.filter((record) => record.size >= threshold).sort((a, b) => b.size - a.size);
}

export function formatCategoryDetail(summary: CategorySummary) {
  const countLabel = `${summary.itemCount} ${summary.itemCount === 1 ? "item" : "items"}`;
  return `${countLabel} · ${formatSummaryStorage(summary.reclaimableBytes)} to review`;
}

export function formatCategoryReviewHint(categoryTitle: string) {
  const normalizedTitle = categoryTitle.trim().toLowerCase();
  return normalizedTitle ? `Opens ${normalizedTitle} cleanup results for review` : "Opens cleanup results for review";
}

export function summarizeCleanup(items: CleanupItem[], largeFileThreshold = 0): CategorySummary[] {
  const categories: CleanupCategory[] = ["duplicates", "large", "temporary"];
  return categories.map((category) => {
    const matching = items.filter((item) => item.category === category && (category !== "large" || item.size >= largeFileThreshold));
    return {
      category,
      itemCount: matching.length,
      reclaimableBytes: matching.reduce((sum, item) => sum + item.size, 0),
      selectedBytes: matching.filter((item) => item.selected).reduce((sum, item) => sum + item.size, 0),
    };
  });
}
