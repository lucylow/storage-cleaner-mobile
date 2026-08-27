const DEFAULT_TIMEOUT_MS = 10_000;

export type XanoConfig = {
  baseUrl: string;
  timeoutMs: number;
  webIntelligenceTimeoutMs: number;
  retries: number;
};

export function getXanoConfig(): XanoConfig {
  return {
    baseUrl: (process.env.EXPO_PUBLIC_XANO_BASE_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, ""),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    webIntelligenceTimeoutMs: 20_000,
    retries: 2,
  };
}

