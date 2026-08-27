import { Platform } from "react-native";
import type { CleanupItem } from "./cleaner-store";
import type { PermissionReadiness } from "./scanner-logic";

export type ScannerMode = "native" | "fallback";

export type ScannerProgress = {
  progress: number;
  category: string;
  discoveredItems: number;
};

export type ScanDeviceOptions = {
  largeFileThreshold: number;
  signal?: AbortSignal;
  waitIfPaused?: () => Promise<void>;
  onProgress?: (progress: ScannerProgress) => void;
};

export async function getMediaPermissionReadiness(): Promise<PermissionReadiness> {
  return Platform.OS === "web" ? "unsupported" : "requestable";
}

export async function openMediaPermissionSettings(): Promise<"open-settings" | "unsupported" | "failed"> {
  return Platform.OS === "web" ? "unsupported" : "failed";
}

export async function scanDevice(options: ScanDeviceOptions): Promise<{
  mode: ScannerMode;
  candidates?: CleanupItem[];
  diagnostic?: import("./scanner-logic").ScanDiagnostic | null;
}> {
  options.onProgress?.({ progress: 100, category: "Ready to review", discoveredItems: 0 });
  return { mode: "fallback", candidates: undefined, diagnostic: null };
}
