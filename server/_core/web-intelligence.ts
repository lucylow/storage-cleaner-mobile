import {
  isAllowedWebIntelligenceQuery,
  isSafeHttpsUrl,
  isSameStorageQuery,
  sanitizeInsightText,
} from "../../shared/web-intelligence-allowlist";

export { isSafeHttpsUrl };

export const FREE_DAILY_SEARCH_LIMIT = 10;
export const PRO_DAILY_SEARCH_LIMIT = 40;
export const WEB_INTELLIGENCE_CACHE_TTL_MS = 60 * 60 * 1000;
export const WEB_INTELLIGENCE_CACHE_LIMIT = 40;

export { isAllowedWebIntelligenceQuery };

export type WebReference = {
  title: string;
  url: string;
  source?: string;
  snippet?: string;
  index: number;
};

export type MappedSearchResult = {
  query: string;
  markdown?: string;
  textBlocks: Array<{ type: string; snippet: string }>;
  references: WebReference[];
  relatedQuestions: string[];
  subsequentRequestToken?: string;
  fromCache?: boolean;
  quotaRemaining?: number;
};

export function isUsableMappedResult(result: Pick<MappedSearchResult, "markdown" | "textBlocks">) {
  return Boolean(result.markdown?.trim() || result.textBlocks.length);
}

export type WebIntelligenceQuotaDecision = {
  allowed: boolean;
  remaining: number;
  limit: number;
};

type QuotaBucket = { day: string; count: number };
type CacheEntry = { expiresAt: number; result: MappedSearchResult };

const quotaByKey = new Map<string, QuotaBucket>();
const responseCache = new Map<string, CacheEntry>();

export function getWebIntelligenceDailyLimit(isPro: boolean) {
  return isPro ? PRO_DAILY_SEARCH_LIMIT : FREE_DAILY_SEARCH_LIMIT;
}

export function utcDayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function consumeWebIntelligenceQuota(
  key: string,
  isPro: boolean,
  now = Date.now(),
): WebIntelligenceQuotaDecision {
  const limit = getWebIntelligenceDailyLimit(isPro);
  const day = utcDayKey(now);
  const current = quotaByKey.get(key);
  const count = current && current.day === day ? current.count : 0;
  if (count >= limit) {
    return { allowed: false, remaining: 0, limit };
  }
  quotaByKey.set(key, { day, count: count + 1 });
  return { allowed: true, remaining: limit - count - 1, limit };
}

export function peekWebIntelligenceQuota(key: string, isPro: boolean, now = Date.now()) {
  const limit = getWebIntelligenceDailyLimit(isPro);
  const day = utcDayKey(now);
  const current = quotaByKey.get(key);
  const count = current && current.day === day ? current.count : 0;
  return { used: count, remaining: Math.max(0, limit - count), limit };
}

export function resetWebIntelligenceQuotaForTests() {
  quotaByKey.clear();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

const ALLOWED_LANGUAGES = new Set(["en", "fr", "es", "de", "pt"]);
const ALLOWED_COUNTRIES = new Set(["us", "fr", "es", "de", "pt"]);

export function sanitizeSearchLocale(language?: string, country?: string) {
  const hl = (language ?? "en").toLowerCase().split(/[-_]/)[0] ?? "en";
  const gl = (country ?? "").toLowerCase().split(/[-_]/)[0] ?? "";
  const languageSafe = ALLOWED_LANGUAGES.has(hl) ? hl : "en";
  const countrySafe = ALLOWED_COUNTRIES.has(gl) ? gl : languageSafe === "en" ? "us" : languageSafe;
  return { language: languageSafe, country: countrySafe };
}

export function sanitizeSubsequentRequestToken(value: unknown) {
  if (typeof value !== "string") return undefined;
  const token = value.trim();
  if (token.length < 16 || token.length > 2048) return undefined;
  if (!/^[A-Za-z0-9._=-]+$/.test(token)) return undefined;
  return token;
}

function listItemSnippet(value: unknown) {
  const entry = asRecord(value);
  return (asString(entry?.snippet || entry?.title || entry?.text).trim() || asString(value).trim());
}

function tableToMarkdown(entry: Record<string, unknown>) {
  const headers = Array.isArray(entry.headers) ? entry.headers.map((cell) => asString(cell).trim()).filter(Boolean) : [];
  const rawRows = Array.isArray(entry.table) ? entry.table : Array.isArray(entry.rows) ? entry.rows : [];
  const rows = rawRows
    .map((row) => (Array.isArray(row) ? row.map((cell) => listItemSnippet(cell)).filter(Boolean) : []))
    .filter((row) => row.length > 0)
    .slice(0, 6);
  if (!headers.length && !rows.length) return "";
  const lines = headers.length ? [headers.join(" · ")] : [];
  for (const row of rows) {
    lines.push(`- ${row.join(" · ")}`);
  }
  return lines.join("\n");
}

function textBlockToMarkdown(type: string, snippet: string, listItems: string[], entry: Record<string, unknown>) {
  if (type === "table") return tableToMarkdown(entry);
  if (type === "heading" && snippet) return `### ${snippet}`;
  if (type === "list" || type === "expandable" || listItems.length) {
    const bullets = listItems.map((item) => `- ${item}`).join("\n");
    return [snippet, bullets].filter(Boolean).join("\n");
  }
  if (type === "code_block") return snippet;
  return snippet;
}

export function mapSerpApiAiModeResponse(raw: unknown, query: string): MappedSearchResult {
  const payload = asRecord(raw) ?? {};
  const textBlocks = Array.isArray(payload.text_blocks)
    ? payload.text_blocks
        .flatMap((block) => {
          const entry = asRecord(block);
          if (!entry) return [];
          const type = asString(entry.type) || "paragraph";
          if (type === "shopping" || type === "local" || type === "images" || type === "videos") return [];
          const listItems = Array.isArray(entry.list)
            ? entry.list.map(listItemSnippet).filter((item) => item.length > 0).slice(0, 8)
            : [];
          const snippet = asString(entry.snippet).trim();
          const markdown = sanitizeInsightText(textBlockToMarkdown(type, snippet, listItems, entry));
          if (!markdown) return [];
          return [{ type, snippet: markdown }];
        })
    : [];

  const markdown =
    sanitizeInsightText(
      asString(payload.reconstructed_markdown).trim() ||
        textBlocks.map((block) => block.snippet).join("\n\n"),
    ) || undefined;

  const references = Array.isArray(payload.references)
    ? payload.references
        .flatMap((reference, fallbackIndex): WebReference[] => {
          const entry = asRecord(reference);
          if (!entry) return [];
          const title = asString(entry.title).trim();
          const url = asString(entry.link || entry.url).trim();
          if (!title || !isSafeHttpsUrl(url)) return [];
          const mapped: WebReference = {
            title,
            url,
            index: typeof entry.index === "number" ? entry.index : fallbackIndex,
          };
          const source = asString(entry.source);
          const snippet = asString(entry.snippet);
          if (source) mapped.source = source;
          if (snippet) mapped.snippet = snippet;
          return [mapped];
        })
        .slice(0, 5)
    : [];

  const relatedQuestions = Array.isArray(payload.related_questions)
    ? payload.related_questions
        .map((item) => {
          const entry = asRecord(item);
          return asString(entry?.question).trim();
        })
        .filter((question) => question.length > 0 && isAllowedWebIntelligenceQuery(question) && !isSameStorageQuery(question, query))
        .slice(0, 4)
    : [];

  const subsequentRequestToken = sanitizeSubsequentRequestToken(payload.subsequent_request_token);

  return {
    query,
    markdown,
    textBlocks,
    references,
    relatedQuestions,
    subsequentRequestToken,
  };
}

export function buildWebIntelligenceCacheKey(
  query: string,
  language = "en",
  country = "us",
) {
  return `${query.trim().toLowerCase()}|${language}|${country}`;
}

export function getCachedWebIntelligenceResult(key: string, now = Date.now()) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    responseCache.delete(key);
    return null;
  }
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.result;
}

export function setCachedWebIntelligenceResult(
  key: string,
  result: MappedSearchResult,
  now = Date.now(),
) {
  if (responseCache.has(key)) responseCache.delete(key);
  const { subsequentRequestToken: _token, ...safeResult } = result;
  responseCache.set(key, { result: safeResult, expiresAt: now + WEB_INTELLIGENCE_CACHE_TTL_MS });
  while (responseCache.size > WEB_INTELLIGENCE_CACHE_LIMIT) {
    const oldest = responseCache.keys().next().value;
    if (!oldest) break;
    responseCache.delete(oldest);
  }
}

export function getWebIntelligenceCacheSize() {
  return responseCache.size;
}

export function resetWebIntelligenceCacheForTests() {
  responseCache.clear();
}

export function resolveQuotaKey(deviceId: unknown, fallback: string) {
  if (typeof deviceId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(deviceId)) {
    return deviceId;
  }
  return fallback || "anonymous";
}
