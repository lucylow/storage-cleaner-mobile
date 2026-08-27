import { logger } from "@/lib/privacy-safe-logger";
import { toPrivacySafeInput } from "./privacy-filter";
import { resolveAIProvider } from "./ai-router";
import { LocalAIProvider } from "./local-analyzer";
import type { AIAnalysisInput, AIAnalysisResult } from "./ai-types";

export async function runAIAnalysis(input: AIAnalysisInput): Promise<AIAnalysisResult> {
  const provider = resolveAIProvider();
  const safeInput = toPrivacySafeInput(input);
  try {
    const result = await provider.analyzeStorage(safeInput);
    logger.info("ai_analysis_completed", {
      scanId: safeInput.scanId,
      reclaimableMb: result.reclaimableBytes,
      confidence: result.confidence,
      privacyMode: result.privacyMode,
      analyzerVersion: result.analyzerVersion,
    });
    return result;
  } catch {
    logger.warn("ai_analysis_fallback", { scanId: safeInput.scanId });
    return new LocalAIProvider().analyzeStorage(safeInput);
  }
}
