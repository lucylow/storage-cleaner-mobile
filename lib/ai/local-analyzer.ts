import { summarizeCleanup } from "@/lib/analysis-logic";
import { buildNaturalLanguageSummary } from "./natural-language-summary";
import { buildRecommendations } from "./recommendation-engine";
import { buildStorageHealth } from "./storage-intelligence";
import type { AIAnalysisInput, AIAnalysisResult, AIRisk, AIProvider } from "./ai-types";

export const ANALYZER_VERSION = "1.0.0";

function buildRisks(input: AIAnalysisInput): AIRisk[] {
  const protectedCount = input.items.filter((item) => item.protected).length;
  const riskyLargeFiles = input.items.filter((item) => item.category === "large" && !item.protected).length;
  const risks: AIRisk[] = [];
  risks.push({ level: "low", summary: "Temporary and exact-duplicate candidates are prioritized for safer cleanup." });
  if (riskyLargeFiles > 0) risks.push({ level: "review", summary: `${riskyLargeFiles} large files should be reviewed manually before removal.` });
  if (protectedCount > 0) risks.push({ level: "protected", summary: `${protectedCount} items are protected and never auto-selected.` });
  return risks;
}

export class LocalAIProvider implements AIProvider {
  async analyzeStorage(input: AIAnalysisInput): Promise<AIAnalysisResult> {
    const recommendations = buildRecommendations(input.items, input.largeFileThresholdMb);
    const categories = summarizeCleanup(input.items, input.largeFileThresholdMb).map((summary) => ({
      category: summary.category,
      reclaimableBytes: summary.reclaimableBytes,
      selectedBytes: summary.selectedBytes,
      itemCount: summary.itemCount,
      recommendation:
        summary.category === "duplicates"
          ? "Start with duplicate groups to preserve one representative copy."
          : summary.category === "large"
            ? "Review large files by size and confidence."
            : "Temporary items are usually low-risk cleanup opportunities.",
    }));
    const reclaimableBytes = input.items.filter((item) => item.selected && !item.protected).reduce((sum, item) => sum + item.size, 0);
    const confidence = recommendations.length
      ? recommendations.reduce((sum, recommendation) => sum + recommendation.confidence, 0) / recommendations.length
      : 0.8;
    const storageHealth = buildStorageHealth(input);
    const base = {
      reclaimableBytes,
      confidence,
      recommendations,
      risks: buildRisks(input),
      categories,
      privacyMode: "local" as const,
      storageHealth,
      analyzerVersion: ANALYZER_VERSION,
      generatedAt: Date.now(),
    };
    return {
      ...base,
      summary: buildNaturalLanguageSummary(base),
    };
  }
}
