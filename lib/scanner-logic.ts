import type { ScannerMode, ScannerProgress } from "./scanner-service";

export function chooseScannerMode(platform: string, nativeAvailable: boolean): ScannerMode {
  return platform !== "web" && nativeAvailable ? "native" : "fallback";
}

export type PermissionReadiness = "unsupported" | "granted" | "requestable" | "blocked";

export function classifyPermissionReadiness(response: { granted: boolean; canAskAgain?: boolean }, platform: string): PermissionReadiness {
  if (platform === "web") return "unsupported";
  if (response.granted) return "granted";
  return response.canAskAgain === false ? "blocked" : "requestable";
}

export function shouldRefreshPermissionOnAppState(previous: string, next: string) {
  return previous !== "active" && next === "active";
}

export function canApplyScanCallback(mounted: boolean, aborted: boolean): boolean {
  return mounted && !aborted;
}

export function canApplyPermissionRefresh(requestId: number, latestRequestId: number, mounted: boolean): boolean {
  return mounted && Number.isInteger(requestId) && requestId === latestRequestId;
}

export type PermissionRecoveryIntent = "open-settings" | "unsupported" | "failed";
export type PermissionRecoveryOutcome = "granted" | "requested-denied" | "open-settings" | "unsupported";

export function shouldShowPermissionNotice(message: string | null, dismissedMessage: string | null) {
  return Boolean(message && message !== dismissedMessage);
}

export function getPermissionAppActiveAnnouncement(readiness: PermissionReadiness): string {
  if (readiness === "granted") return "Media access is ready again. You can continue your local scan.";
  if (readiness === "blocked") return "Media access is still blocked in Settings. Your files were not changed.";
  if (readiness === "requestable") return "Media access still needs approval. Your files were not changed.";
  return "Native media access is unavailable here. Your files were not changed.";
}

export function getPermissionRefreshAnnouncement(outcome: "refreshed" | "failed"): string {
  return outcome === "refreshed" ? "Media access status refreshed. You can retry the local scan." : "Media access could not be checked. You can retry safely.";
}

export function getPermissionRecoveryAnnouncement(outcome: PermissionRecoveryOutcome): string {
  if (outcome === "granted") return "Media access is ready. You can scan this device locally.";
  if (outcome === "requested-denied") return "Media access was not granted. Your files were not changed.";
  if (outcome === "open-settings") return "Device Settings opened. Return here after reviewing media access.";
  return "Media access recovery is unavailable here. Your files were not changed.";
}

export function getPermissionSettingsHandoffAnnouncement(intent: PermissionRecoveryIntent) {
  if (intent === "open-settings") return "Device Settings opened. Review media access, then return here to check again.";
  if (intent === "unsupported") return "Device Settings recovery is unavailable here. Your files were not changed.";
  return "Device Settings could not be opened. You can retry safely.";
}

export function getPermissionRecoveryLabel(intent: PermissionRecoveryIntent) {
  return intent === "open-settings" ? "Opening device Settings" : intent === "unsupported" ? "Settings recovery is unavailable here" : "Could not open Settings";
}

export function getPermissionReadinessLabel(readiness: PermissionReadiness) {
  return {
    unsupported: "Native media access unavailable",
    granted: "Media access ready",
    requestable: "Media access needs approval",
    blocked: "Media access blocked in Settings",
  }[readiness];
}

export type ScanDiagnosticCode = "unsupported" | "permission-denied" | "media-read-failed" | "unknown";
export type ScanDiagnostic = { code: ScanDiagnosticCode; message: string };

export function sanitizePersistedScanLabel(value: unknown): string {
  const safeLabels = new Set(["Never scanned", "Just now", "Cleaned just now", "Cleanup needs attention", "Cleanup undone"]);
  return typeof value === "string" && safeLabels.has(value) ? value : "Never scanned";
}

export function sanitizePersistedScanDiagnostic(value: unknown): ScanDiagnostic | null {
  if (!value || typeof value !== "object") return null;
  const code = (value as Partial<ScanDiagnostic>).code;
  if (code !== "unsupported" && code !== "permission-denied" && code !== "media-read-failed" && code !== "unknown") return null;
  return sanitizeScanDiagnostic(code);
}

export function sanitizeScanDiagnostic(code: ScanDiagnosticCode, message?: string): ScanDiagnostic {
  const messages: Record<ScanDiagnosticCode, string> = {
    unsupported: "Native media access is unavailable here. A safe local preview was used.",
    "permission-denied": "Media permission was not granted. No files were changed.",
    "media-read-failed": "Some on-device media could not be read. You can retry safely.",
    unknown: "The local scan could not finish. You can retry safely.",
  };
  return { code, message: messages[code] || message || messages.unknown };
}

export type NativeMediaRecord = { id: string; filename: string; uri: string; sizeBytes: number; mediaType: "photo" | "video"; contentSignature?: string };
export type NativeCleanupCandidate = { id: string; name: string; location: string; size: number; category: "duplicates" | "large" | "temporary"; selected: boolean; protected?: boolean };

export function mapNativeMediaToCandidates(records: NativeMediaRecord[], largeFileThreshold = 500): NativeCleanupCandidate[] {
  const getSignature = (record: NativeMediaRecord) => record.contentSignature ? `content:${record.contentSignature}` : `name:${record.filename.toLowerCase().replace(/ copy|\s\(\d+\)/g, "")}`;
  const signatureCounts = new Map<string, number>();
  for (const record of records) {
    const signature = getSignature(record);
    signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);
  }
  const seenSignatures = new Map<string, number>();
  return records.map((record) => {
    const signature = getSignature(record);
    const duplicateIndex = seenSignatures.get(signature) ?? 0;
    seenSignatures.set(signature, duplicateIndex + 1);
    const size = record.sizeBytes / (1024 * 1024);
    const isDuplicate = (signatureCounts.get(signature) ?? 0) > 1;
    const isTemporary = /cache|temp|thumbnail/i.test(record.filename);
    const category = isDuplicate ? "duplicates" : size >= largeFileThreshold ? "large" : isTemporary ? "temporary" : "large";
    return { id: record.id, name: record.filename, location: record.mediaType === "video" ? "Videos · On device" : "Photos · On device", size: Number(size.toFixed(1)), category, selected: isDuplicate ? duplicateIndex > 0 : isTemporary };
  });
}

export function getNativePageSize(pageIndex: number, discoveredItems: number) {
  if (discoveredItems >= 400) return 10;
  if (pageIndex >= 4 || discoveredItems >= 200) return 25;
  return 50;
}

export function mergeNativeMediaPage(existing: NativeMediaRecord[], page: NativeMediaRecord[]) {
  const seen = new Set(existing.map((record) => record.id));
  return [...existing, ...page.filter((record) => !seen.has(record.id))];
}

export type ScanSessionState = "idle" | "running" | "paused" | "backgrounded";

export const SCAN_TIMEOUT_OPTIONS_MS = [60_000, 120_000, 300_000] as const;
export const SCAN_SESSION_TIMEOUT_MS = SCAN_TIMEOUT_OPTIONS_MS[1];

export type ScanDiagnosticCounters = { timeoutCount: number; cancellationCount: number };

export function formatScanTimeout(timeoutMs: number) {
  const minutes = Math.round(timeoutMs / 60_000);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

export function getNextScanTimeout(current: number) {
  const index = SCAN_TIMEOUT_OPTIONS_MS.indexOf(current as (typeof SCAN_TIMEOUT_OPTIONS_MS)[number]);
  return SCAN_TIMEOUT_OPTIONS_MS[(index + 1) % SCAN_TIMEOUT_OPTIONS_MS.length];
}

export function sanitizeScanDiagnosticCounters(value: unknown): ScanDiagnosticCounters {
  if (!value || typeof value !== "object") return { timeoutCount: 0, cancellationCount: 0 };
  const candidate = value as { timeoutCount?: unknown; cancellationCount?: unknown };
  const normalize = (count: unknown) => typeof count === "number" && Number.isFinite(count) && count >= 0 ? Math.min(1_000_000, Math.floor(count)) : 0;
  return {
    timeoutCount: normalize(candidate.timeoutCount),
    cancellationCount: normalize(candidate.cancellationCount),
  };
}

export function shouldExpireScanSession(backgroundedAt: number | null, now: number, timeoutMs: number = SCAN_SESSION_TIMEOUT_MS) {
  return backgroundedAt !== null && now - backgroundedAt >= timeoutMs;
}

export function getScanResumeMessage(sessionState: ScanSessionState) {
  if (sessionState === "backgrounded") return "Your scan is paused safely. Resume when you are ready.";
  if (sessionState === "paused") return "Your scan is paused. Resume to continue local analysis.";
  if (sessionState === "running") return "Your scan is running locally on this device.";
  return null;
}

export function getScanSessionState(appState: string, isScanning: boolean, isPaused: boolean): ScanSessionState {
  if (!isScanning) return "idle";
  if (appState !== "active") return "backgrounded";
  return isPaused ? "paused" : "running";
}

export function getScanControlLabel(isScanning: boolean, isPaused: boolean) {
  if (!isScanning) return "Start scan";
  return isPaused ? "Resume scan" : "Pause scan";
}

export type ScanControlAnnouncement = "paused" | "backgrounded" | "resumed" | "cancelled";

export function getScanControlAnnouncement(state: ScanControlAnnouncement) {
  if (state === "paused") return "Scan paused safely. No files were changed.";
  if (state === "backgrounded") return "Scan paused safely because the app went to the background.";
  if (state === "resumed") return "Scan resumed safely. Local analysis is continuing.";
  return "Scan cancelled safely. No files were changed.";
}

export function getScanProgressMilestone(progress: number) {
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
  if (safeProgress >= 100) return 100;
  if (safeProgress >= 75) return 75;
  if (safeProgress >= 50) return 50;
  if (safeProgress >= 25) return 25;
  return 0;
}

export function getScanPhaseLabel(progress: number, category: string) {
  if (category === "Scan cancelled") return "Cancelled safely";
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
  if (safeProgress >= 100) return "Ready to review";
  if (safeProgress >= 70) return "Analyzing locally";
  if (safeProgress >= 20) return "Reading on-device data";
  return "Preparing local scan";
}

export function aggregateProgress(current: ScannerProgress, next: ScannerProgress): ScannerProgress {
  const currentProgress = Number.isFinite(current.progress) ? Math.max(0, Math.min(100, current.progress)) : 0;
  const nextProgress = Number.isFinite(next.progress) ? Math.max(0, Math.min(100, next.progress)) : currentProgress;
  const currentDiscovered = Number.isFinite(current.discoveredItems) ? Math.max(0, Math.floor(current.discoveredItems)) : 0;
  const nextDiscovered = Number.isFinite(next.discoveredItems) ? Math.max(0, Math.floor(next.discoveredItems)) : currentDiscovered;
  return {
    progress: Math.max(currentProgress, nextProgress),
    category: typeof next.category === "string" && next.category.trim() ? next.category : current.category,
    discoveredItems: Math.max(currentDiscovered, nextDiscovered),
  };
}
