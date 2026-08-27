import type { CleanupItem } from "@/lib/cleaner-store";

export type DuplicateGroup = {
  key: string;
  items: CleanupItem[];
  representativeId: string;
};

function normalizedKey(item: CleanupItem): string {
  return item.name
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/\s*\((\d+)\)$/g, "")
    .replace(/\scopy\b/g, "")
    .trim();
}

export function buildDuplicateGroups(items: CleanupItem[]): DuplicateGroup[] {
  const duplicateItems = items.filter((item) => item.category === "duplicates");
  const groups = new Map<string, CleanupItem[]>();
  for (const item of duplicateItems) {
    const key = normalizedKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()]
    .map(([key, grouped]) => ({
      key,
      items: grouped.sort((a, b) => b.size - a.size),
      representativeId: grouped.sort((a, b) => b.size - a.size)[0]?.id ?? grouped[0]?.id ?? "",
    }))
    .filter((group) => group.items.length > 1);
}
