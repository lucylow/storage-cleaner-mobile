import { afterEach, describe, expect, it } from "vitest";
import {
  consumeWebIntelligenceQuota,
  getCachedWebIntelligenceResult,
  getWebIntelligenceCacheSize,
  getWebIntelligenceDailyLimit,
  isAllowedWebIntelligenceQuery,
  isSafeHttpsUrl,
  mapSerpApiAiModeResponse,
  peekWebIntelligenceQuota,
  resetWebIntelligenceCacheForTests,
  resetWebIntelligenceQuotaForTests,
  sanitizeSearchLocale,
  sanitizeSubsequentRequestToken,
  setCachedWebIntelligenceResult,
  WEB_INTELLIGENCE_CACHE_LIMIT,
} from "../server/_core/web-intelligence";
import { getSerpApiPayloadError, googleDomainForCountry, isSerpApiCircuitOpen, recordSerpApiCircuitFailureForTests, resetSerpApiCircuitForTests } from "../server/_core/serpapi";
import { sanitizeInsightText } from "../shared/web-intelligence-allowlist";

describe("web intelligence allowlist", () => {
  it("accepts privacy-safe storage templates", () => {
    expect(isAllowedWebIntelligenceQuery("How to review duplicate photos on iOS and keep one original")).toBe(true);
    expect(isAllowedWebIntelligenceQuery("What large video files are safe to offload on Android")).toBe(true);
    expect(isAllowedWebIntelligenceQuery("Is it safe to remove temporary cache files on mobile devices")).toBe(true);
    expect(isAllowedWebIntelligenceQuery("Comment supprimer les photos en double sur iOS")).toBe(true);
    expect(isAllowedWebIntelligenceQuery("Comment examiner les photos en double sur iOS et garder un original")).toBe(true);
    expect(isAllowedWebIntelligenceQuery("Wie pruefe ich doppelte Fotos auf iOS und behalte ein Original")).toBe(true);
    expect(isAllowedWebIntelligenceQuery("Como revisar fotos duplicadas no iOS e manter um original")).toBe(true);
    expect(isAllowedWebIntelligenceQuery("Is it safe to remove temporary cache files")).toBe(true);
    expect(isAllowedWebIntelligenceQuery("How to review duplicate photos and large video files on iOS safely")).toBe(true);
  });

  it("rejects open-web, path, filename, email, and phone queries", () => {
    expect(isAllowedWebIntelligenceQuery("delete now please")).toBe(false);
    expect(isAllowedWebIntelligenceQuery("best restaurants near me")).toBe(false);
    expect(isAllowedWebIntelligenceQuery("/var/mobile/Containers/IMG_4821.JPG")).toBe(false);
    expect(isAllowedWebIntelligenceQuery("C:\\Users\\me\\photo.jpg")).toBe(false);
    expect(isAllowedWebIntelligenceQuery("delete my vacation-photo.mp4")).toBe(false);
    expect(isAllowedWebIntelligenceQuery("email results to user@example.com")).toBe(false);
    expect(isAllowedWebIntelligenceQuery("https://example.com/storage")).toBe(false);
    expect(isAllowedWebIntelligenceQuery("call 5551234567 about storage cleanup")).toBe(false);
  });
});

describe("Google AI Mode mapper", () => {
  afterEach(() => {
    resetWebIntelligenceCacheForTests();
    resetWebIntelligenceQuotaForTests();
  });

  it("prefers reconstructed markdown and ignores shopping results", () => {
    const mapped = mapSerpApiAiModeResponse(
      {
        reconstructed_markdown: "Keep one original photo.",
        shopping_results: [{ title: "Hard drive", price: "$90" }],
        references: [{ title: "Apple Support", link: "https://support.apple.com", source: "Apple", index: 0 }],
        related_questions: [{ question: "Is it safe to remove temporary cache files on iOS" }, { question: "best restaurants near me" }],
      },
      "How to review duplicate photos on iOS and keep one original",
    );
    expect(mapped.markdown).toBe("Keep one original photo.");
    expect(mapped.references[0]?.url).toBe("https://support.apple.com");
    expect(mapped.relatedQuestions).toEqual(["Is it safe to remove temporary cache files on iOS"]);
  });

  it("falls back to text blocks when markdown is missing", () => {
    const mapped = mapSerpApiAiModeResponse(
      {
        text_blocks: [{ type: "paragraph", snippet: "Review large videos before offloading." }],
      },
      "What large video files are safe to offload on Android",
    );
    expect(mapped.markdown).toBe("Review large videos before offloading.");
    expect(mapped.textBlocks).toHaveLength(1);
  });

  it("reconstructs list blocks and drops unsafe references", () => {
    const mapped = mapSerpApiAiModeResponse(
      {
        text_blocks: [
          { type: "heading", snippet: "Safe cleanup" },
          { type: "list", list: [{ snippet: "Keep one original" }, { title: "Review large videos" }] },
          { type: "shopping", snippet: "Buy a hard drive" },
        ],
        references: [
          { title: "Apple Support", link: "https://support.apple.com", index: 0 },
          { title: "Bad", link: "javascript:alert(1)", index: 1 },
          { title: "Also bad", link: "http://example.com", index: 2 },
        ],
      },
      "How to review duplicate photos on iOS and keep one original",
    );
    expect(mapped.markdown).toContain("### Safe cleanup");
    expect(mapped.markdown).toContain("- Keep one original");
    expect(mapped.markdown).not.toContain("Buy a hard drive");
    expect(mapped.references).toEqual([expect.objectContaining({ url: "https://support.apple.com" })]);
  });

  it("maps table blocks and drops paths, emails, and duplicate related questions", () => {
    const mapped = mapSerpApiAiModeResponse(
      {
        text_blocks: [
          {
            type: "table",
            headers: ["Action", "Risk"],
            rows: [["Review duplicates", "Low"], ["Offload large videos", "Medium"]],
          },
          { type: "paragraph", snippet: "Do not email user@example.com or open /var/mobile/Containers/photo.jpg" },
        ],
        related_questions: [
          { question: "How to review duplicate photos on iOS and keep one original" },
          { question: "Is it safe to remove temporary cache files on iOS" },
        ],
        subsequent_request_token: "tok_abcdefghijklmnopqrstuvwxyz",
        references: [
          { title: "Local", link: "https://localhost/tips", index: 0 },
          { title: "Apple Support", link: "https://support.apple.com", index: 1 },
        ],
      },
      "How to review duplicate photos on iOS and keep one original",
    );
    expect(mapped.markdown).toContain("Action · Risk");
    expect(mapped.markdown).toContain("- Review duplicates · Low");
    expect(mapped.markdown).not.toContain("user@example.com");
    expect(mapped.markdown).not.toContain("/var/mobile");
    expect(mapped.markdown).not.toContain("photo.jpg");
    expect(mapped.relatedQuestions).toEqual(["Is it safe to remove temporary cache files on iOS"]);
    expect(mapped.subsequentRequestToken).toBe("tok_abcdefghijklmnopqrstuvwxyz");
    expect(mapped.references).toEqual([expect.objectContaining({ url: "https://support.apple.com" })]);
  });

  it("never stores conversation tokens in the server cache", () => {
    setCachedWebIntelligenceResult("how to review duplicate photos|en|us", {
      query: "How to review duplicate photos on iOS and keep one original",
      markdown: "Keep one original.",
      textBlocks: [],
      references: [],
      relatedQuestions: [],
      subsequentRequestToken: "tok_abcdefghijklmnopqrstuvwxyz",
    });
    expect(getCachedWebIntelligenceResult("how to review duplicate photos|en|us")?.subsequentRequestToken).toBeUndefined();
  });
});

describe("server daily quota", () => {
  afterEach(() => {
    resetWebIntelligenceQuotaForTests();
    resetSerpApiCircuitForTests();
  });

  it("enforces 10 free and 40 pro searches", () => {
    expect(getWebIntelligenceDailyLimit(false)).toBe(10);
    expect(getWebIntelligenceDailyLimit(true)).toBe(40);
    const now = Date.parse("2026-08-22T12:00:00.000Z");
    expect(peekWebIntelligenceQuota("device-1", false, now).used).toBe(0);
    for (let index = 0; index < 10; index += 1) {
      expect(consumeWebIntelligenceQuota("device-1", false, now).allowed).toBe(true);
    }
    expect(peekWebIntelligenceQuota("device-1", false, now).remaining).toBe(0);
    expect(consumeWebIntelligenceQuota("device-1", false, now).allowed).toBe(false);
    expect(consumeWebIntelligenceQuota("pro-device", true, now).allowed).toBe(true);
  });

  it("treats empty Google AI Mode payloads as unusable", () => {
    const empty = mapSerpApiAiModeResponse({}, "How to review duplicate photos on iOS and keep one original");
    expect(empty.markdown).toBeUndefined();
    expect(empty.textBlocks).toEqual([]);
  });

  it("treats SerpApi error payloads as failures and sanitizes locale", () => {
    expect(getSerpApiPayloadError({ error: "Unsupported private API." })).toContain("unavailable");
    expect(getSerpApiPayloadError({ search_metadata: { status: "Error" } })).toContain("usable");
    expect(getSerpApiPayloadError({ search_metadata: { status: "Success" } })).toBeNull();
    expect(sanitizeSearchLocale("fr-FR", "xx")).toEqual({ language: "fr", country: "fr" });
    expect(sanitizeSearchLocale("zh", "cn")).toEqual({ language: "en", country: "us" });
    expect(isSafeHttpsUrl("https://support.apple.com/kb/test")).toBe(true);
    expect(isSafeHttpsUrl("javascript:alert(1)")).toBe(false);
    expect(googleDomainForCountry("fr")).toBe("google.fr");
    expect(googleDomainForCountry("us")).toBe("google.com");
    expect(googleDomainForCountry("xx")).toBe("google.com");
    expect(isSafeHttpsUrl("https://127.0.0.1/tips")).toBe(false);
    expect(isSafeHttpsUrl("https://router.local/tips")).toBe(false);
    expect(sanitizeSubsequentRequestToken("short")).toBeUndefined();
    expect(sanitizeSubsequentRequestToken("tok_abcdefghijklmnopqrstuvwxyz")).toBe("tok_abcdefghijklmnopqrstuvwxyz");
    expect(sanitizeInsightText("Email user@example.com about IMG_4821.JPG")).not.toMatch(/@|IMG_4821/);
  });

  it("opens the SerpApi circuit after five failures", () => {
    resetSerpApiCircuitForTests();
    expect(isSerpApiCircuitOpen()).toBe(false);
    for (let index = 0; index < 5; index += 1) {
      recordSerpApiCircuitFailureForTests();
    }
    expect(isSerpApiCircuitOpen()).toBe(true);
    resetSerpApiCircuitForTests();
    expect(isSerpApiCircuitOpen()).toBe(false);
  });

  it("evicts the oldest cached Google AI Mode result", () => {
    resetWebIntelligenceCacheForTests();
    const now = 1_700_000_000_000;
    for (let index = 0; index < WEB_INTELLIGENCE_CACHE_LIMIT + 1; index += 1) {
      setCachedWebIntelligenceResult(
        `query-${index}|en|us`,
        { query: `query-${index}`, textBlocks: [], references: [], relatedQuestions: [] },
        now + index,
      );
    }
    expect(getWebIntelligenceCacheSize()).toBe(WEB_INTELLIGENCE_CACHE_LIMIT);
  });
});
