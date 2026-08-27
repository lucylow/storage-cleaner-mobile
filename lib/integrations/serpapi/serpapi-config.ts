export type SerpApiConfig = {
  enabled: boolean;
};

export function getSerpApiConfig(): SerpApiConfig {
  return {
    enabled: (process.env.EXPO_PUBLIC_ENABLE_WEB_INTELLIGENCE ?? "false").toLowerCase() === "true",
  };
}

export function isWebIntelligenceFlagEnabled() {
  return getSerpApiConfig().enabled;
}

