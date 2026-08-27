import { appConfig } from "@/lib/config";
import type { AIAnalysisInput, AIAnalysisResult, AIProvider } from "./ai-types";
import { LocalAIProvider } from "./local-analyzer";

class UnavailableCloudProvider implements AIProvider {
  async analyzeStorage(_input: AIAnalysisInput): Promise<AIAnalysisResult> {
    throw new Error("Cloud AI provider is unavailable in this build.");
  }
}

export function resolveAIProvider(): AIProvider {
  if (appConfig.aiMode === "hybrid" && appConfig.cloudAIEnabled) {
    return new UnavailableCloudProvider();
  }
  return new LocalAIProvider();
}
