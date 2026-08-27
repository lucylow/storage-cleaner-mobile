import { describe, expect, it } from "vitest";
import type { AIAnalysisResult } from "../lib/ai/ai-types";
import { attachWebInsight, emptyWebInsight, isUsableSearchPayload, sanitizePersistedWebInsight, searchResultToWebInsight, toPlainInsightText, webInsightErrorMessage } from "../lib/integrations/serpapi/web-insight-fusion";
import { searchLocaleFromAppLocale } from "../lib/integrations/serpapi/search-locale";
import { canConsumeDailySearch, canRefreshWebInsight, getDailySearchLimit, nextQuotaState, normalizeQuotaState, quotaStateFromRemaining } from "../lib/integrations/serpapi/web-intelligence-quota";

const localAnalysis: AIAnalysisResult = {
  summary: "Local report",
  reclaimableBytes: 12,
  confidence: 0.9,
  recommendations: [
    {
      id: "rec-1",
      itemId: "item-1",
      title: "Temporary thumbnails",
      category: "temporary",
      confidence: 0.9,
      confidenceLevel: "high",
      riskLevel: "low",
      reason: "temporary",
      explanation: "Temporary data is generally safe to remove.",
      action: "safe-to-remove",
      estimatedSavingsMb: 12,
    },
  ],
  risks: [],
  categories: [],
  privacyMode: "local",
  storageHealth: { score: 80, label: "Healthy", reasons: [], recommendations: [] },
  analyzerVersion: "1.0.0",
  generatedAt: 1,
};

describe("web insight fusion", () => {
  it("attaches web insight without overwriting local recommendations", () => {
    const fused = attachWebInsight(
      localAnalysis,
      searchResultToWebInsight({
        query: "How to review duplicate photos on iOS and keep one original",
        markdown: "## Tips\nKeep one original.",
        textBlocks: [],
        references: [{ title: "Apple Support", url: "https://support.apple.com", source: "Apple", index: 0 }],
        relatedQuestions: ["Is it safe to remove temporary cache files on iOS"],
      }),
    );
    expect(fused.recommendations).toEqual(localAnalysis.recommendations);
    expect(fused.summary).toBe("Local report");
    expect(fused.privacyMode).toBe("cloud-consented");
    expect(fused.webInsight?.status).toBe("ready");
    expect(fused.webInsight?.references).toHaveLength(1);
  });

  it("keeps local privacy mode when the insight is not ready", () => {
    const fused = attachWebInsight(localAnalysis, emptyWebInsight("error"));
    expect(fused.privacyMode).toBe("local");
    expect(fused.recommendations[0]?.itemId).toBe("item-1");
  });

  it("flattens markdown for the card without keeping raw markup", () => {
    expect(toPlainInsightText("### Heading\nKeep **one** [original](https://example.com).")).toBe(
      "Heading\nKeep one original.",
    );
  });

  it("restores only privacy-safe ready insights and drops tokens", () => {
    expect(sanitizePersistedWebInsight({
      status: "ready",
      query: "How to review duplicate photos on iOS and keep one original",
      markdown: "Keep one original.",
      references: [{ title: "Apple", url: "https://support.apple.com", index: 0 }],
      relatedQuestions: [
        "best restaurants near me",
        "How to review duplicate photos on iOS and keep one original",
        "Is it safe to remove temporary cache files on iOS",
      ],
      fetchedAt: Date.now(),
      subsequentRequestToken: "secret-token",
    })).toMatchObject({
      status: "ready",
      fromCache: true,
      relatedQuestions: ["Is it safe to remove temporary cache files on iOS"],
    });
    expect(sanitizePersistedWebInsight({
      status: "ready",
      query: "How to review duplicate photos on iOS and keep one original",
      markdown: "Email user@example.com and open /var/mobile/Containers/photo.jpg",
      fetchedAt: Date.now(),
      references: [{ title: "Local", url: "https://localhost/tips", index: 0 }],
    })?.markdown).not.toMatch(/@|\/var\/mobile|photo\.jpg/);
    expect(sanitizePersistedWebInsight({ status: "ready", query: "/var/mobile/IMG_4821.JPG", markdown: "nope", fetchedAt: 1 })).toBeNull();
    expect(sanitizePersistedWebInsight({
      status: "ready",
      query: "How to review duplicate photos on iOS and keep one original",
      markdown: "Keep one original.",
      fetchedAt: 1,
    }, 1 + 25 * 60 * 60 * 1000)).toBeNull();
    expect(webInsightErrorMessage("quota")).toContain("limit");
    expect(isUsableSearchPayload({ markdown: "", textBlocks: [], disabled: false })).toBe(false);
    expect(isUsableSearchPayload({ markdown: "Keep one original.", textBlocks: [], disabled: false })).toBe(true);
  });

  it("maps app locale to Google AI Mode language and country", () => {
    expect(searchLocaleFromAppLocale("fr")).toEqual({ language: "fr", country: "fr" });
    expect(searchLocaleFromAppLocale("pt")).toEqual({ language: "pt", country: "pt" });
    expect(searchLocaleFromAppLocale("unknown")).toEqual({ language: "en", country: "us" });
    expect(searchLocaleFromAppLocale("en-US")).toEqual({ language: "en", country: "us" });
    expect(searchLocaleFromAppLocale("fr-FR")).toEqual({ language: "fr", country: "fr" });
  });
});

describe("web intelligence daily cap", () => {
  it("allows 10 free searches and 40 pro searches per UTC day", () => {
    expect(getDailySearchLimit(false)).toBe(10);
    expect(getDailySearchLimit(true)).toBe(40);
    expect(canConsumeDailySearch(9, false)).toBe(true);
    expect(canConsumeDailySearch(10, false)).toBe(false);
    expect(canConsumeDailySearch(39, true)).toBe(true);
    expect(canRefreshWebInsight(false)).toBe(false);
    expect(canRefreshWebInsight(true)).toBe(true);
  });

  it("resets quota when the UTC day changes", () => {
    const laterDay = Date.parse("2026-08-23T00:00:00.000Z");
    const normalized = normalizeQuotaState({ day: "2026-08-22", count: 10 }, laterDay);
    expect(normalized).toEqual({ day: "2026-08-23", count: 0 });
    expect(nextQuotaState(normalized, laterDay).count).toBe(1);
  });

  it("syncs local usage from the server remaining count", () => {
    const now = Date.parse("2026-08-23T12:00:00.000Z");
    expect(quotaStateFromRemaining(7, false, now)).toEqual({ day: "2026-08-23", count: 3 });
    expect(quotaStateFromRemaining(40, true, now)).toEqual({ day: "2026-08-23", count: 0 });
    expect(quotaStateFromRemaining("7", false, now)).toBeNull();
  });
});
