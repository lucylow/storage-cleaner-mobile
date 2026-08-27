import type { AIAnalysisInput, StorageHealth } from "./ai-types";

function toGb(bytes: number) {
  return bytes / (1024 ** 3);
}

export function buildStorageHealth(input: AIAnalysisInput): StorageHealth {
  const reasons: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  if (input.totalDeviceBytes && input.usedDeviceBytes) {
    const usedPct = Math.round((input.usedDeviceBytes / input.totalDeviceBytes) * 100);
    if (usedPct > 90) score -= 30;
    else if (usedPct > 80) score -= 20;
    else if (usedPct > 70) score -= 10;
    reasons.push(`Storage is ${usedPct}% full.`);
  }

  const reclaimableMb = input.items.filter((item) => item.selected && !item.protected).reduce((sum, item) => sum + item.size, 0);
  if (reclaimableMb > 4000) score -= 18;
  else if (reclaimableMb > 2000) score -= 12;
  else if (reclaimableMb > 800) score -= 6;
  reasons.push(`${(reclaimableMb / 1024).toFixed(1)} GB appears reclaimable.`);

  const duplicateCount = input.items.filter((item) => item.category === "duplicates").length;
  if (duplicateCount > 20) score -= 10;
  else if (duplicateCount > 10) score -= 5;
  reasons.push(`${duplicateCount} duplicate candidates were detected.`);

  if ((input.scanFreshnessMinutes ?? 0) > 60) {
    score -= 8;
    reasons.push("Scan data is older than one hour.");
  }

  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const label =
    safeScore >= 90 ? "Excellent" : safeScore >= 75 ? "Healthy" : safeScore >= 55 ? "Needs attention" : "Critical";

  const freeGb = input.freeDeviceBytes ? toGb(input.freeDeviceBytes) : null;
  if (freeGb !== null && freeGb < 15) recommendations.push("Review low-risk duplicate items first to improve free space.");
  recommendations.push("Keep protected items excluded from any automated selection.");

  return { score: safeScore, label, reasons, recommendations };
}
