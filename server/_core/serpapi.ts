import { ENV } from "./env";

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";
const REQUEST_TIMEOUT_MS = 18_000;
const RETRY_MAX = 2;
const RETRY_BASE_DELAY_MS = 400;
const JSON_RESTRICTOR =
  "error,reconstructed_markdown,text_blocks,references,related_questions,subsequent_request_token,search_metadata";

export type GoogleAiModeParams = {
  query: string;
  language?: string;
  country?: string;
  device?: "mobile" | "desktop" | "tablet";
  continuable?: boolean;
  subsequentRequestToken?: string;
  noCache?: boolean;
};

const GOOGLE_DOMAIN: Record<string, string> = {
  us: "google.com",
  fr: "google.fr",
  es: "google.es",
  de: "google.de",
  pt: "google.pt",
};

export function googleDomainForCountry(country?: string) {
  const code = (country ?? "us").toLowerCase();
  return GOOGLE_DOMAIN[code] ?? "google.com";
}

export class SerpApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "SerpApiError";
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CIRCUIT_FAILURE_LIMIT = 5;
const CIRCUIT_COOLDOWN_MS = 60_000;
let circuitFailures = 0;
let circuitOpenUntil = 0;

export function resetSerpApiCircuitForTests() {
  circuitFailures = 0;
  circuitOpenUntil = 0;
}

export function isSerpApiCircuitOpen(now = Date.now()) {
  return now < circuitOpenUntil;
}

export function recordSerpApiCircuitFailureForTests(now = Date.now()) {
  noteSerpApiFailure(now);
}

function noteSerpApiSuccess() {
  circuitFailures = 0;
  circuitOpenUntil = 0;
}

function noteSerpApiFailure(now = Date.now()) {
  circuitFailures += 1;
  if (circuitFailures >= CIRCUIT_FAILURE_LIMIT) {
    circuitOpenUntil = now + CIRCUIT_COOLDOWN_MS;
  }
}

export function isSerpApiConfigured() {
  return ENV.serpApiKey.trim().length > 0;
}

export function getSerpApiPayloadError(raw: unknown) {
  if (!raw || typeof raw !== "object") return "Google AI Mode returned an empty response.";
  const payload = raw as Record<string, unknown>;
  if (typeof payload.error === "string" && payload.error.trim()) {
    return "Google AI Mode is temporarily unavailable.";
  }
  const metadata = payload.search_metadata && typeof payload.search_metadata === "object"
    ? (payload.search_metadata as Record<string, unknown>)
    : null;
  const status = typeof metadata?.status === "string" ? metadata.status.toLowerCase() : "";
  if (status && status !== "success") {
    return "Google AI Mode did not return a usable result.";
  }
  return null;
}

export async function fetchGoogleAiMode(params: GoogleAiModeParams): Promise<unknown> {
  if (!isSerpApiConfigured()) {
    throw new SerpApiError("SERPAPI_API_KEY is not configured", 503);
  }
  if (isSerpApiCircuitOpen()) {
    throw new SerpApiError("Google AI Mode is temporarily unavailable.", 503);
  }

  const url = new URL(SERPAPI_ENDPOINT);
  url.searchParams.set("engine", "google_ai_mode");
  url.searchParams.set("q", params.query);
  url.searchParams.set("api_key", ENV.serpApiKey);
  url.searchParams.set("hl", params.language || "en");
  url.searchParams.set("gl", params.country || "us");
  url.searchParams.set("device", params.device || "mobile");
  url.searchParams.set("google_domain", googleDomainForCountry(params.country));
  url.searchParams.set("output", "json");
  url.searchParams.set("json_restrictor", JSON_RESTRICTOR);
  if (params.continuable) url.searchParams.set("continuable", "true");
  if (params.noCache) url.searchParams.set("no_cache", "true");
  if (params.subsequentRequestToken) {
    url.searchParams.set("subsequent_request_token", params.subsequentRequestToken);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_MAX; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { method: "GET", signal: controller.signal });
      if (response.ok) {
        const payload = await response.json();
        const failure = getSerpApiPayloadError(payload);
        if (failure) {
          noteSerpApiFailure();
          throw new SerpApiError(failure, 502);
        }
        noteSerpApiSuccess();
        return payload;
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === RETRY_MAX) {
        noteSerpApiFailure();
        throw new SerpApiError("Google AI Mode is temporarily unavailable.", response.status);
      }
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    } catch (error) {
      lastError = error;
      if (error instanceof SerpApiError) throw error;
      if (attempt === RETRY_MAX) {
        noteSerpApiFailure();
        throw new SerpApiError("Google AI Mode request timed out.", 504);
      }
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new SerpApiError("Google AI Mode request failed.", 502);
}
