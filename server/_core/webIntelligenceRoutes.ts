import type { Express, Request, Response } from "express";
import { fetchGoogleAiMode, isSerpApiConfigured, SerpApiError } from "./serpapi";
import {
  buildWebIntelligenceCacheKey,
  consumeWebIntelligenceQuota,
  getCachedWebIntelligenceResult,
  peekWebIntelligenceQuota,
  isAllowedWebIntelligenceQuery,
  isUsableMappedResult,
  mapSerpApiAiModeResponse,
  resolveQuotaKey,
  sanitizeSearchLocale,
  sanitizeSubsequentRequestToken,
  setCachedWebIntelligenceResult,
  type MappedSearchResult,
} from "./web-intelligence";

const inflightSearches = new Map<string, Promise<MappedSearchResult>>();

function clientFallbackKey(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || req.ip || "anonymous";
  }
  return req.ip || "anonymous";
}

export function registerWebIntelligenceRoutes(app: Express) {
  app.post("/v1/web-intelligence/search", async (req: Request, res: Response) => {
    const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
    const options = req.body?.options && typeof req.body.options === "object" ? req.body.options : {};
    const locale = sanitizeSearchLocale(
      typeof options.language === "string" ? options.language : "en",
      typeof options.country === "string" ? options.country : "us",
    );
    const language = locale.language;
    const country = locale.country;
    const device = options.device === "desktop" || options.device === "tablet" ? options.device : "mobile";
    const isPro = options.isPro === true;
    const noCache = options.noCache === true;
    const quotaKey = resolveQuotaKey(req.body?.deviceId ?? options.deviceId, clientFallbackKey(req));

    if (!query) {
      res.status(400).json({ error: "A storage question is required." });
      return;
    }

    if (!isAllowedWebIntelligenceQuery(query)) {
      res.status(400).json({ error: "Only privacy-safe storage questions are allowed.", code: "blocked" });
      return;
    }

    if (!isSerpApiConfigured()) {
      res.status(503).json({ error: "Live web tips are unavailable right now.", code: "unavailable" });
      return;
    }

    const cacheKey = buildWebIntelligenceCacheKey(query, language, country);
    if (!noCache) {
      const cached = getCachedWebIntelligenceResult(cacheKey);
      if (cached) {
        res.json({
          data: {
            ...cached,
            fromCache: true,
            quotaRemaining: peekWebIntelligenceQuota(quotaKey, isPro).remaining,
          },
        });
        return;
      }
    }

    const quota = peekWebIntelligenceQuota(quotaKey, isPro);
    if (quota.remaining <= 0) {
      res.status(429).json({ error: "Daily live web tip limit reached.", code: "quota" });
      return;
    }

    const subsequentRequestToken = sanitizeSubsequentRequestToken(options.subsequentRequestToken);
    const inflightKey = `${cacheKey}|${noCache ? "fresh" : "reuse"}|${subsequentRequestToken ? "turn" : "start"}`;

    try {
      let pending = inflightSearches.get(inflightKey);
      if (!pending) {
        pending = fetchGoogleAiMode({
          query,
          language,
          country,
          device,
          continuable: options.continuable === true,
          noCache,
          subsequentRequestToken,
        })
          .then((raw) => mapSerpApiAiModeResponse(raw, query))
          .finally(() => {
            inflightSearches.delete(inflightKey);
          });
        inflightSearches.set(inflightKey, pending);
      }
      const mapped = await pending;
      if (isUsableMappedResult(mapped)) {
        consumeWebIntelligenceQuota(quotaKey, isPro);
        if (!noCache) setCachedWebIntelligenceResult(cacheKey, mapped);
      }
      res.json({
        data: {
          ...mapped,
          fromCache: false,
          quotaRemaining: peekWebIntelligenceQuota(quotaKey, isPro).remaining,
        },
      });
    } catch (error) {
      const status = error instanceof SerpApiError && error.status ? error.status : 502;
      res.status(status >= 400 && status < 600 ? status : 502).json({
        error: "Live web tips could not be loaded. Local analysis is unchanged.",
        code: status === 504 || status === 408 ? "network" : "unavailable",
      });
    }
  });
}
