import { isAllowedWebIntelligenceQuery } from "../../../shared/web-intelligence-allowlist";
import { getSerpApiConfig } from "./serpapi-config";
import { getCachedSearch, setCachedSearch } from "./serpapi-cache";
import { serpApiClient } from "./serpapi-client";
import { buildStorageQueryContext, buildStorageWebQueries, type StorageQueryContext } from "./query-builder";
import { isUsableSearchPayload } from "./web-insight-fusion";
import type { SearchOptions, SearchResultPayload } from "./serpapi-types";

const inflightSearches = new Map<string, Promise<SearchResultPayload>>();

export function emptySearchPayload(query: string, disabled: boolean): SearchResultPayload {
  return {
    query,
    markdown: "",
    textBlocks: [],
    references: [],
    relatedQuestions: [],
    disabled,
  };
}

function searchInflightKey(query: string, options?: SearchOptions) {
  return [
    query,
    options?.language ?? "en",
    options?.country ?? "us",
    options?.subsequentRequestToken ?? "",
    options?.noCache ? "fresh" : "reuse",
  ].join("|");
}

async function fetchPublicWebKnowledge(
  query: string,
  options?: SearchOptions,
): Promise<SearchResultPayload> {
  const config = getSerpApiConfig();
  const language = options?.language ?? "en";
  const country = options?.country ?? "us";
  if (!config.enabled) {
    return emptySearchPayload(query, true);
  }
  if (!isAllowedWebIntelligenceQuery(query)) {
    return emptySearchPayload(query, true);
  }

  if (!options?.noCache) {
    const cached = getCachedSearch(query, language, country);
    if (cached) return { ...cached, disabled: false, fromCache: true };
  }

  const result = await serpApiClient.search(query, {
    language,
    country,
    device: options?.device ?? "mobile",
    continuable: options?.continuable,
    subsequentRequestToken: options?.subsequentRequestToken,
    deviceId: options?.deviceId,
    isPro: options?.isPro,
    noCache: options?.noCache,
  });
  const payload = { ...result, disabled: false, fromCache: result.fromCache === true };
  if (isUsableSearchPayload(payload)) {
    setCachedSearch(query, result, language, country);
  }
  return payload;
}

export async function searchPublicWebKnowledge(
  query: string,
  options?: SearchOptions,
): Promise<SearchResultPayload> {
  const key = searchInflightKey(query, options);
  const pending = inflightSearches.get(key);
  if (pending) return pending;

  const request = fetchPublicWebKnowledge(query, options).finally(() => {
    inflightSearches.delete(key);
  });
  inflightSearches.set(key, request);
  return request;
}

export async function searchStorageWebInsight(
  context: StorageQueryContext,
  options?: SearchOptions,
): Promise<SearchResultPayload> {
  const queries = buildStorageWebQueries(context, options?.language);
  if (!queries.length) {
    return emptySearchPayload("", true);
  }

  let lastError: unknown;
  for (const query of queries) {
    try {
      const payload = await searchPublicWebKnowledge(query, options);
      if (isUsableSearchPayload(payload)) return payload;
      if (payload.disabled) return payload;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return emptySearchPayload(queries[0] ?? "", false);
}

export function createStorageSearchContext(
  items: Array<{ category: "duplicates" | "large" | "temporary"; size: number }>,
  platform: StorageQueryContext["platform"],
) {
  return buildStorageQueryContext(items, platform);
}
