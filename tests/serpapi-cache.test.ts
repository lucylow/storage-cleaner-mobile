import { afterEach, describe, expect, it } from "vitest";
import {
  WEB_INTELLIGENCE_CACHE_LIMIT,
  WEB_INTELLIGENCE_CACHE_TTL_MS,
  clearCachedSearches,
  getCachedSearch,
  getCachedSearchSize,
  setCachedSearch,
} from "../lib/integrations/serpapi/serpapi-cache";
import type { SearchResult } from "../lib/integrations/serpapi/serpapi-types";

const sample = (query: string): SearchResult => ({
  query,
  markdown: `${query} answer`,
  textBlocks: [],
  references: [],
  relatedQuestions: [],
});

describe("web intelligence cache", () => {
  afterEach(() => {
    clearCachedSearches();
  });

  it("returns cached results before TTL and expires them afterward", () => {
    const now = 1_700_000_000_000;
    setCachedSearch("duplicate photos on iOS", sample("duplicate photos on iOS"), "en", "us", now);
    expect(getCachedSearch("duplicate photos on iOS", "en", "us", now + 1_000)?.markdown).toBe("duplicate photos on iOS answer");
    expect(getCachedSearch("duplicate photos on iOS", "en", "us", now + WEB_INTELLIGENCE_CACHE_TTL_MS + 1)).toBeNull();
  });

  it("evicts the oldest entry when the cache exceeds 20 items", () => {
    const now = 1_700_000_000_000;
    for (let index = 0; index < WEB_INTELLIGENCE_CACHE_LIMIT + 1; index += 1) {
      setCachedSearch(`query ${index}`, sample(`query ${index}`), "en", "us", now + index);
    }
    expect(getCachedSearchSize()).toBe(WEB_INTELLIGENCE_CACHE_LIMIT);
    expect(getCachedSearch("query 0", "en", "us", now + 100)).toBeNull();
    expect(getCachedSearch("query 20", "en", "us", now + 100)?.query).toBe("query 20");
  });

  it("strips conversation tokens before caching", () => {
    setCachedSearch("duplicate photos on iOS", {
      ...sample("duplicate photos on iOS"),
      subsequentRequestToken: "tok_abcdefghijklmnopqrstuvwxyz",
    });
    expect(getCachedSearch("duplicate photos on iOS")?.subsequentRequestToken).toBeUndefined();
  });
});
