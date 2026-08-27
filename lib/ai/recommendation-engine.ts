import type { CleanupItem } from "@/lib/cleaner-store";
import { getConfidenceLevel } from "./confidence";
import { explainRecommendation } from "./cleanup-explainer";
import { buildDuplicateGroups } from "./duplicate-intelligence";
import { getItemRiskLevel } from "./risk-scoring";
import type { AIRecommendation, RecommendationReason } from "./ai-types";

function inferReason(item: CleanupItem, representativeIds: Set<string>, threshold: number): RecommendationReason {
  if (item.protected) return "protected";
  if (item.category === "temporary") return "temporary";
  if (item.category === "large" && item.size >= threshold) return "large-file";
  if (item.category === "duplicates" && representativeIds.has(item.id)) return "representative";
  if (item.category === "duplicates") return item.name.toLowerCase().includes("copy") ? "near-duplicate" : "exact-duplicate";
  return "low-confidence";
}

function confidenceFor(item: CleanupItem, reason: RecommendationReason): number {
  if (reason === "protected" || reason === "representative") return 0.99;
  if (reason === "exact-duplicate") return 0.96;
  if (reason === "temporary") return 0.92;
  if (reason === "near-duplicate") return 0.74;
  if (reason === "large-file") return item.size >= 1024 ? 0.8 : 0.68;
  return 0.52;
}

export function buildRecommendations(items: CleanupItem[], largeFileThresholdMb: number): AIRecommendation[] {
  const groups = buildDuplicateGroups(items);
  const representativeIds = new Set(groups.map((group) => group.representativeId));
  return items.map((item) => {
    const reason = inferReason(item, representativeIds, largeFileThresholdMb);
    const confidence = confidenceFor(item, reason);
    const confidenceLevel = getConfidenceLevel(confidence);
    return {
      id: `rec-${item.id}`,
      itemId: item.id,
      title: item.name,
      category: item.category,
      confidence,
      confidenceLevel,
      riskLevel: getItemRiskLevel(item),
      reason,
      explanation: explainRecommendation(item, reason),
      action: item.protected || reason === "representative" ? "protect" : confidence >= 0.85 ? "safe-to-remove" : "review",
      estimatedSavingsMb: item.protected ? 0 : item.size,
    };
  });
}
