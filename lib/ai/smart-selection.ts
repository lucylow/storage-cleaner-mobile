import type { CleanupItem } from "@/lib/cleaner-store";
import type { AIRecommendation } from "./ai-types";

export function applyLowRiskSelection(items: CleanupItem[], recommendations: AIRecommendation[]): CleanupItem[] {
  const safeIds = new Set(
    recommendations
      .filter((recommendation) => recommendation.action === "safe-to-remove" && recommendation.riskLevel === "low")
      .map((recommendation) => recommendation.itemId),
  );
  return items.map((item) => (item.protected ? { ...item, selected: false } : { ...item, selected: safeIds.has(item.id) }));
}

export function getAutoSelectedSavingsMb(items: CleanupItem[]): number {
  return items.filter((item) => item.selected && !item.protected).reduce((sum, item) => sum + item.size, 0);
}
