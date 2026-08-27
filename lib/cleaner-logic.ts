import type { CleanupCategory, CleanupHistoryEntry, CleanupItem, CleanupSummary, ScanHistoryEntry } from "./cleaner-store";

const MAX_NAME_LENGTH = 256;
const HISTORY_LIMIT = 10;

export function formatStorage(megabytes: number) {
  if (!Number.isFinite(megabytes) || megabytes < 0) return "0 MB";
  if (megabytes >= 1000) return `${(megabytes / 1000).toFixed(1)} GB`;
  return `${megabytes % 1 === 0 ? megabytes.toFixed(1) : megabytes.toFixed(1)} MB`;
}

export function formatHistoryDate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString();
}

export function isSelectable(item: CleanupItem) {
  return item.selected && !item.protected;
}

export function calculateSelectedBytes(items: CleanupItem[]) {
  return items.filter(isSelectable).reduce((sum, item) => sum + item.size, 0);
}

export function getSelectedCleanupItems(items: CleanupItem[]) {
  return items.filter(isSelectable);
}

export function toggleCleanupItem(items: CleanupItem[], id: string) {
  return items.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item));
}

export function selectAllInCategory(items: CleanupItem[], category: CleanupCategory) {
  return items.map((item) => (item.category === category && !item.protected ? { ...item, selected: true } : item));
}

export function setCategorySelection(items: CleanupItem[], category: CleanupCategory, selected: boolean) {
  if (category !== "duplicates" || !selected) {
    return items.map((item) => (item.category === category && !item.protected ? { ...item, selected } : item));
  }
  let keptOriginal = false;
  return items.map((item) => {
    if (item.category !== "duplicates" || item.protected) return item;
    if (!keptOriginal) {
      keptOriginal = true;
      return { ...item, selected: false };
    }
    return { ...item, selected: true };
  });
}

export function setItemProtected(items: CleanupItem[], id: string, protectedFlag: boolean) {
  return items.map((item) => (item.id === id ? { ...item, protected: protectedFlag, selected: protectedFlag ? false : false } : item));
}

export function getProtectedItems(items: CleanupItem[]) {
  return items.filter((item) => item.protected);
}

export function removeSelectedItems(items: CleanupItem[]) {
  return items.filter((item) => !isSelectable(item)).map((item) => (item.protected ? { ...item, selected: false } : item));
}

function isRestoreableItem(item: CleanupItem) {
  return Boolean(item.id) && item.name.length <= MAX_NAME_LENGTH && !item.protected && Number.isFinite(item.size);
}

export function restoreCleanupItems(current: CleanupItem[], pending: CleanupItem[]) {
  const seen = new Set(current.map((item) => item.id));
  const restored: CleanupItem[] = [];
  for (const item of pending) {
    if (seen.has(item.id) || !isRestoreableItem(item)) continue;
    seen.add(item.id);
    restored.push(item);
  }
  return [...current, ...restored];
}

export function createCleanupSummary(items: CleanupItem[]): CleanupSummary {
  const selected = getSelectedCleanupItems(items);
  return { reclaimedBytes: selected.reduce((sum, item) => sum + item.size, 0), itemCount: selected.length };
}

export function canUndoCleanup(mode: string, status: string) {
  return mode === "fallback" && status === "unsupported";
}

export function isValidScanHistoryEntry(value: unknown): value is ScanHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<ScanHistoryEntry>;
  return Boolean(entry.id) && typeof entry.scannedAt === "number" && Number.isFinite(entry.scannedAt) && entry.scannedAt >= 0 && typeof entry.reclaimableBytes === "number" && Number.isFinite(entry.reclaimableBytes) && entry.reclaimableBytes >= 0 && Number.isInteger(entry.itemCount) && (entry.itemCount ?? -1) >= 0;
}

export function appendScanHistory(history: ScanHistoryEntry[], entry: ScanHistoryEntry, limit = HISTORY_LIMIT) {
  if (!Number.isFinite(limit) || limit < 0) return [];
  if (!isValidScanHistoryEntry(entry)) return history;
  const next = [entry, ...history.filter((item) => item.id !== entry.id)];
  return next.slice(0, limit);
}

export function sanitizeScanHistory(value: unknown): ScanHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((entry): entry is ScanHistoryEntry => {
    if (!isValidScanHistoryEntry(entry) || seen.has(entry.id) || !entry.id.trim()) return false;
    seen.add(entry.id);
    return true;
  });
}

export function sanitizeCleanupSummary(value: unknown): CleanupSummary | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<CleanupSummary>;
  if (typeof entry.reclaimedBytes !== "number" || !Number.isFinite(entry.reclaimedBytes) || entry.reclaimedBytes < 0) return null;
  if (typeof entry.itemCount !== "number" || !Number.isInteger(entry.itemCount) || entry.itemCount < 0) return null;
  return { reclaimedBytes: entry.reclaimedBytes, itemCount: entry.itemCount };
}

function isValidCleanupItem(value: unknown): value is CleanupItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CleanupItem>;
  return (
    typeof item.id === "string" &&
    item.id.trim().length > 0 &&
    typeof item.name === "string" &&
    item.name.length > 0 &&
    item.name.length <= MAX_NAME_LENGTH &&
    typeof item.location === "string" &&
    item.location.length > 0 &&
    item.location.length <= MAX_NAME_LENGTH &&
    typeof item.size === "number" &&
    Number.isFinite(item.size) &&
    (item.category === "duplicates" || item.category === "large" || item.category === "temporary") &&
    typeof item.selected === "boolean"
  );
}

export function sanitizeCleanupItems(value: unknown, limit = Number.POSITIVE_INFINITY): CleanupItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const next: CleanupItem[] = [];
  for (const item of value) {
    if (!isValidCleanupItem(item) || seen.has(item.id) || !item.id.trim()) continue;
    seen.add(item.id);
    next.push(item.protected ? { ...item, selected: false } : item);
    if (next.length >= limit) break;
  }
  return next;
}

export function sanitizeCleanupHistory(value: unknown, limit = 20): CleanupHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const statuses = new Set(["completed", "partial", "failed"]);
  const next: CleanupHistoryEntry[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Partial<CleanupHistoryEntry>;
    if (typeof item.id !== "string" || !item.id.trim() || seen.has(item.id)) continue;
    if (typeof item.completedAt !== "number" || !Number.isFinite(item.completedAt)) continue;
    if (typeof item.reclaimedBytes !== "number" || !Number.isFinite(item.reclaimedBytes)) continue;
    if (!Number.isInteger(item.itemCount)) continue;
    if (!statuses.has(String(item.status))) continue;
    seen.add(item.id);
    next.push({
      id: item.id,
      completedAt: item.completedAt,
      reclaimedBytes: item.reclaimedBytes,
      itemCount: item.itemCount ?? 0,
      status: item.status as CleanupHistoryEntry["status"],
      undoAvailable: item.undoAvailable === true,
    });
    if (next.length >= limit) break;
  }
  return next;
}

export function getRecommendation(item: CleanupItem, items: CleanupItem[], largeFileThresholdMb = 500) {
  if (item.protected) return "Protected. Review before removing.";
  if (item.category === "large" && item.size < largeFileThresholdMb) return "Below threshold";
  if (item.category === "duplicates") {
    const group = items.filter((candidate) => candidate.category === "duplicates" && !candidate.protected);
    return group[0]?.id === item.id ? "Keep one original" : "Likely duplicate";
  }
  if (item.category === "temporary") return "Safe temporary data";
  return "Review before removing";
}
