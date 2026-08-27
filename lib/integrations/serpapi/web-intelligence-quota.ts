export const FREE_DAILY_SEARCH_LIMIT = 10;
export const PRO_DAILY_SEARCH_LIMIT = 40;
export const WEB_INTELLIGENCE_QUOTA_KEY = "storage-cleaner-web-intel-quota-v1";

export type WebIntelligenceQuotaState = {
  day: string;
  count: number;
};

export function getDailySearchLimit(isPro: boolean) {
  return isPro ? PRO_DAILY_SEARCH_LIMIT : FREE_DAILY_SEARCH_LIMIT;
}

export function utcDayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function normalizeQuotaState(value: unknown, now = Date.now()): WebIntelligenceQuotaState {
  const day = utcDayKey(now);
  if (!value || typeof value !== "object") return { day, count: 0 };
  const entry = value as Partial<WebIntelligenceQuotaState>;
  if (entry.day !== day || typeof entry.count !== "number" || !Number.isFinite(entry.count) || entry.count < 0) {
    return { day, count: 0 };
  }
  return { day, count: Math.floor(entry.count) };
}

export function canConsumeDailySearch(usedToday: number, isPro: boolean) {
  return usedToday < getDailySearchLimit(isPro);
}

export function canRefreshWebInsight(isPro: boolean) {
  return isPro;
}

export function nextQuotaState(current: WebIntelligenceQuotaState, now = Date.now()): WebIntelligenceQuotaState {
  const normalized = normalizeQuotaState(current, now);
  return { day: normalized.day, count: normalized.count + 1 };
}

export function quotaStateFromRemaining(remaining: unknown, isPro: boolean, now = Date.now()): WebIntelligenceQuotaState | null {
  if (typeof remaining !== "number" || !Number.isFinite(remaining)) return null;
  const limit = getDailySearchLimit(isPro);
  const safeRemaining = Math.max(0, Math.min(limit, Math.floor(remaining)));
  return { day: utcDayKey(now), count: limit - safeRemaining };
}
