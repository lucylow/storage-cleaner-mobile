import type { AIConfidenceLevel } from "./ai-types";

export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function getConfidenceLevel(confidence: number): AIConfidenceLevel {
  const safe = clampConfidence(confidence);
  if (safe >= 0.85) return "high";
  if (safe >= 0.6) return "medium";
  return "needs-review";
}
