import type { AIAnalysisResult, WebInsight, WebInsightErrorCode } from "@/lib/ai/ai-types";
import {
  isAllowedWebIntelligenceQuery,
  isSafeHttpsUrl,
  isSameStorageQuery,
  sanitizeInsightText,
} from "../../../shared/web-intelligence-allowlist";
import type { SearchResult, SearchResultPayload } from "./serpapi-types";

export function isUsableSearchPayload(payload: Pick<SearchResultPayload, "disabled" | "markdown" | "textBlocks">) {
  return !payload.disabled && Boolean(payload.markdown?.trim() || payload.textBlocks.length);
}

export function emptyWebInsight(
  status: WebInsight["status"],
  query = "",
  errorCode?: WebInsightErrorCode,
): WebInsight {
  return {
    status,
    query,
    markdown: "",
    references: [],
    relatedQuestions: [],
    fetchedAt: Date.now(),
    errorCode,
  };
}

export function toPlainInsightText(markdown: string, maxChars = 620): string {
  const plain = sanitizeInsightText(markdown)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[#*_`>]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (plain.length <= maxChars) return plain;
  return `${plain.slice(0, maxChars).trimEnd()}…`;
}

export function searchResultToWebInsight(result: SearchResult, status: WebInsight["status"] = "ready"): WebInsight {
  const markdown = sanitizeInsightText(result.markdown?.trim() || result.textBlocks.map((block) => block.snippet).join("\n\n"));
  return {
    status,
    query: result.query,
    markdown,
    references: result.references.filter((reference) => isSafeHttpsUrl(reference.url)).slice(0, 3),
    relatedQuestions: result.relatedQuestions.filter((question) => isAllowedWebIntelligenceQuery(question) && !isSameStorageQuery(question, result.query)).slice(0, 3),
    fetchedAt: Date.now(),
    fromCache: "fromCache" in result ? Boolean((result as { fromCache?: boolean }).fromCache) : false,
  };
}

export function attachWebInsight(analysis: AIAnalysisResult, insight: WebInsight): AIAnalysisResult {
  return {
    ...analysis,
    recommendations: analysis.recommendations,
    categories: analysis.categories,
    risks: analysis.risks,
    webInsight: insight,
    privacyMode: insight.status === "ready" ? "cloud-consented" : analysis.privacyMode,
  };
}

export const WEB_INSIGHT_PERSIST_TTL_MS = 24 * 60 * 60 * 1000;

export function sanitizePersistedWebInsight(value: unknown, now = Date.now()): WebInsight | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<WebInsight>;
  if (entry.status !== "ready") return null;
  if (typeof entry.query !== "string" || !isAllowedWebIntelligenceQuery(entry.query)) return null;
  if (typeof entry.markdown !== "string" || !entry.markdown.trim()) return null;
  if (typeof entry.fetchedAt !== "number" || !Number.isFinite(entry.fetchedAt)) return null;
  if (now - entry.fetchedAt > WEB_INSIGHT_PERSIST_TTL_MS) return null;
  const markdown = sanitizeInsightText(entry.markdown);
  if (!markdown) return null;
  return {
    status: "ready",
    query: entry.query,
    markdown,
    references: Array.isArray(entry.references)
      ? entry.references.filter((reference) => {
          if (!reference || typeof reference.title !== "string" || typeof reference.url !== "string") return false;
          return isSafeHttpsUrl(reference.url);
        }).slice(0, 3)
      : [],
    relatedQuestions: Array.isArray(entry.relatedQuestions)
      ? entry.relatedQuestions.filter((question) => typeof question === "string" && isAllowedWebIntelligenceQuery(question) && !isSameStorageQuery(question, entry.query ?? "")).slice(0, 3)
      : [],
    fetchedAt: entry.fetchedAt,
    fromCache: true,
  };
}

export function webInsightErrorMessage(code?: WebInsightErrorCode) {
  if (code === "quota") return "Today’s live web tip limit is reached. Your local AI report is unchanged.";
  if (code === "unavailable") return "Live web tips are unavailable right now. Your local AI report is unchanged.";
  if (code === "blocked") return "That follow-up was blocked to keep questions privacy-safe.";
  if (code === "empty") return "No public storage guidance came back for this scan. Try again after another scan.";
  return "Live web tips could not be loaded. Your local AI report is unchanged.";
}
