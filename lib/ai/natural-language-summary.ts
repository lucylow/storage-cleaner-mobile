import type { AIAnalysisResult } from "./ai-types";

function formatGb(mb: number) {
  return `${(mb / 1024).toFixed(1)} GB`;
}

export function buildNaturalLanguageSummary(result: Omit<AIAnalysisResult, "summary">): string {
  const duplicate = result.categories.find((category) => category.category === "duplicates");
  const topCategory = [...result.categories].sort((a, b) => b.reclaimableBytes - a.reclaimableBytes)[0];
  return `Your storage is ${result.storageHealth.label.toLowerCase()}. We found up to ${formatGb(result.reclaimableBytes)} to review, with the largest opportunity in ${topCategory?.category ?? "duplicates"}${duplicate ? ` (${formatGb(duplicate.reclaimableBytes)} in duplicates)` : ""}.`;
}
