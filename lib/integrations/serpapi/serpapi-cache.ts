import type { SearchResult } from "./serpapi-types";

export const WEB_INTELLIGENCE_CACHE_TTL_MS = 60 * 60 * 1000;
export const WEB_INTELLIGENCE_CACHE_LIMIT = 20;

type CacheEntry = {
  result: SearchResult;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

export function buildSearchCacheKey(query: string, language = "en", country = "us") {
  return `${query.trim().toLowerCase()}|${language}|${country}`;
}

export function getCachedSearch(query: string, language = "en", country = "us", now = Date.now()): SearchResult | null {
  const key = buildSearchCacheKey(query, language, country);
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.result;
}

export function setCachedSearch(
  query: string,
  result: SearchResult,
  language = "en",
  country = "us",
  now = Date.now(),
) {
  const key = buildSearchCacheKey(query, language, country);
  if (cache.has(key)) cache.delete(key);
  const { subsequentRequestToken: _token, ...safeResult } = result;
  cache.set(key, { result: safeResult, expiresAt: now + WEB_INTELLIGENCE_CACHE_TTL_MS });
  while (cache.size > WEB_INTELLIGENCE_CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

export function clearCachedSearches() {
  cache.clear();
}

export function getCachedSearchSize() {
  return cache.size;
}
