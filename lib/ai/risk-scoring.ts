import type { CleanupItem } from "@/lib/cleaner-store";
import type { AIRiskLevel } from "./ai-types";

export function getItemRiskLevel(item: CleanupItem): AIRiskLevel {
  if (item.protected) return "protected";
  if (item.category === "temporary") return "low";
  if (item.category === "duplicates" && item.selected) return "low";
  return "review";
}
