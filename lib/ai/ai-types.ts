import type { CleanupCategory, CleanupItem } from "@/lib/cleaner-store";
import type { WebReference } from "@/lib/integrations/serpapi/serpapi-types";

export type WebInsightStatus = "off" | "loading" | "ready" | "disabled" | "error";
export type WebInsightErrorCode = "quota" | "network" | "empty" | "unavailable" | "blocked";

export type WebInsight = {
  status: WebInsightStatus;
  query: string;
  markdown: string;
  references: WebReference[];
  relatedQuestions: string[];
  fetchedAt: number;
  fromCache?: boolean;
  refreshing?: boolean;
  errorCode?: WebInsightErrorCode;
};

export type AIPrivacyMode = "local" | "cloud-consented";
export type AIConfidenceLevel = "high" | "medium" | "needs-review";
export type AIRiskLevel = "low" | "review" | "protected";

export type RecommendationReason =
  | "exact-duplicate"
  | "near-duplicate"
  | "large-file"
  | "temporary"
  | "old-item"
  | "low-confidence"
  | "protected"
  | "representative";

export type AIRecommendation = {
  id: string;
  itemId: string;
  title: string;
  category: CleanupCategory;
  confidence: number;
  confidenceLevel: AIConfidenceLevel;
  riskLevel: AIRiskLevel;
  reason: RecommendationReason;
  explanation: string;
  action: "review" | "safe-to-remove" | "protect";
  estimatedSavingsMb: number;
};

export type AIRisk = {
  level: AIRiskLevel;
  summary: string;
};

export type AICategoryInsight = {
  category: CleanupCategory;
  reclaimableBytes: number;
  selectedBytes: number;
  itemCount: number;
  recommendation: string;
};

export type StorageHealth = {
  score: number;
  label: "Excellent" | "Healthy" | "Needs attention" | "Critical";
  reasons: string[];
  recommendations: string[];
};

export type AIAnalysisInput = {
  scanId: string;
  items: CleanupItem[];
  totalDeviceBytes?: number;
  usedDeviceBytes?: number;
  freeDeviceBytes?: number;
  scanFreshnessMinutes?: number;
  largeFileThresholdMb: number;
};

export type AIAnalysisResult = {
  summary: string;
  reclaimableBytes: number;
  confidence: number;
  recommendations: AIRecommendation[];
  risks: AIRisk[];
  categories: AICategoryInsight[];
  privacyMode: AIPrivacyMode;
  storageHealth: StorageHealth;
  analyzerVersion: string;
  generatedAt: number;
  webInsight?: WebInsight;
};

export interface AIProvider {
  analyzeStorage(input: AIAnalysisInput): Promise<AIAnalysisResult>;
}
