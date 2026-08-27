const APP_VERSION_FALLBACK = "1.0.0";

export type AIMode = "local-only" | "hybrid";

export type AppConfig = {
  demoMode: boolean;
  aiMode: AIMode;
  cloudAIEnabled: boolean;
  appVersion: string;
};

function parseBoolean(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

function parseAIMode(value: string | undefined): AIMode {
  if (!value) return "local-only";
  return value === "hybrid" ? "hybrid" : "local-only";
}

export function getAppConfig(): AppConfig {
  return {
    demoMode: parseBoolean(process.env.EXPO_PUBLIC_DEMO_MODE, false),
    aiMode: parseAIMode(process.env.EXPO_PUBLIC_AI_MODE),
    cloudAIEnabled: parseBoolean(process.env.EXPO_PUBLIC_ENABLE_CLOUD_AI, false),
    appVersion: process.env.EXPO_PUBLIC_APP_VERSION?.trim() || APP_VERSION_FALLBACK,
  };
}

export const appConfig = getAppConfig();
