import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

export type StorageInfo = { totalBytes: number; freeBytes: number; usedBytes: number; percentUsed: number; source: "native" | "unavailable" };

export async function getDeviceStorageInfo(): Promise<StorageInfo | null> {
  if (Platform.OS === "web") return null;
  try {
    const [freeBytes, totalBytes] = await Promise.all([FileSystem.getFreeDiskStorageAsync(), FileSystem.getTotalDiskCapacityAsync()]);
    if (!Number.isFinite(freeBytes) || !Number.isFinite(totalBytes) || totalBytes <= 0 || freeBytes < 0) return null;
    const normalizedFree = Math.min(freeBytes, totalBytes);
    return { totalBytes, freeBytes: normalizedFree, usedBytes: Math.max(totalBytes - normalizedFree, 0), percentUsed: Math.min(100, Math.max(0, ((totalBytes - normalizedFree) / totalBytes) * 100)), source: "native" };
  } catch {
    return null;
  }
}
