import type { AIAnalysisInput } from "./ai-types";

export function toPrivacySafeInput(input: AIAnalysisInput): AIAnalysisInput {
  return {
    ...input,
    items: input.items.map((item) => ({
      ...item,
      name: item.name.replace(/\.[a-z0-9]{2,5}$/i, "").slice(0, 24),
      location: "on-device",
    })),
  };
}

export function toWebSafeScanItems(items: AIAnalysisInput["items"]) {
  return items.map((item) => ({
    category: item.category,
    size: item.size,
  }));
}
