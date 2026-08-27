export type DiagnosticSummaryInput = {
  timeoutCount: number;
  cancellationCount: number;
  lastScanLabel: string;
  permissionReadiness: string;
  persistenceStatus: string;
  lastDiagnosticMessage?: string | null;
};

function safeCount(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.min(1_000_000, Math.floor(value)) : 0;
}

export function formatDiagnosticCount(value: unknown): string {
  const count = typeof value === "number" ? safeCount(value) : 0;
  return count.toLocaleString();
}

export function hasSanitizedDiagnosticCounters(value: unknown): boolean {
  if (!value || typeof value !== "object") return true;
  const candidate = value as { timeoutCount?: unknown; cancellationCount?: unknown };
  return safeCount(candidate.timeoutCount as number) !== candidate.timeoutCount || safeCount(candidate.cancellationCount as number) !== candidate.cancellationCount;
}

export function hydrateDiagnosticCounters(value: unknown): { timeoutCount: number; cancellationCount: number; recovered: boolean } {
  const recovered = value !== undefined && hasSanitizedDiagnosticCounters(value);
  const candidate = value && typeof value === "object" ? value as { timeoutCount?: unknown; cancellationCount?: unknown } : {};
  return {
    timeoutCount: safeCount(candidate.timeoutCount as number),
    cancellationCount: safeCount(candidate.cancellationCount as number),
    recovered,
  };
}

export function getDiagnosticHydrationRecoveryMessage(): string {
  return "Some local diagnostic counters were corrected to safe values. No file data was affected.";
}

function safeText(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  const redacted = normalized
    .replace(/[\r\n]+/g, " ")
    .replace(/(?:[A-Za-z]:[\\/]|\/|ph:\/\/)[^\s,;]+/g, "[redacted]");
  return redacted.slice(0, 120);
}

export function getDiagnosticCopyState(isMounted: boolean, success: boolean): { copyingSummary: boolean; message: string } | null {
  if (!isMounted) return null;
  return { copyingSummary: false, message: getDiagnosticCopyMessage(success) };
}

export function getDiagnosticStatusRowAccessibilityLabel(label: string, value: string, detail?: string): string {
  const normalizedLabel = normalizeDiagnosticMessage(label, "Status");
  const normalizedValue = normalizeDiagnosticMessage(detail ?? value, "Unavailable");
  return `${normalizedLabel}: ${normalizedValue}`;
}

export function getDiagnosticMetricAccessibilityLabel(label: string, value: number): string {
  const normalizedLabel = normalizeDiagnosticMessage(label, "Diagnostic metric");
  return `${normalizedLabel}: ${Number.isFinite(value) ? value : 0}`;
}

export function normalizeDiagnosticMessage(message: string, fallback = "", newlineSeparator = " "): string {
  return message.replace(/[\r\n]+/g, newlineSeparator).replace(/\s{2,}/g, " ").trim() || fallback;
}

export function getDiagnosticStatusAccessibilityLabel(presentation: { title: string; message: string; tone?: "success" | "warning" }): string {
  const title = normalizeDiagnosticMessage(presentation.title, "Diagnostic status");
  const message = normalizeDiagnosticMessage(presentation.message, "No diagnostic details available.");
  const tone = presentation.tone === "warning" ? "Warning" : "Success";
  return `Local-only diagnostic status. ${tone}. ${title}. ${message}`;
}

export function getDiagnosticStatusPresentation(hasDiagnostic: boolean): { title: string; message: string; icon: "info-outline" | "check-circle-outline"; tone: "warning" | "success" } {
  return hasDiagnostic
    ? { title: "Scan needs attention", message: "A sanitized diagnostic warning is present.", icon: "info-outline", tone: "warning" }
    : { title: "No recorded scan issue", message: "The latest local scan completed without a sanitized diagnostic warning.", icon: "check-circle-outline", tone: "success" };
}

export function getDiagnosticPreviewState(showing: boolean): { expanded: boolean; label: string; hint: string; buttonText: string; icon: "visibility" | "visibility-off" } {
  return showing
    ? { expanded: true, label: "Hide diagnostic summary preview", hint: "Closes the local-only preview", buttonText: "Hide summary preview", icon: "visibility-off" }
    : { expanded: false, label: "Preview diagnostic summary", hint: "Shows the exact local-only summary before copying or sharing", buttonText: "Preview summary", icon: "visibility" };
}

export function getDiagnosticPreviewAccessibilityLabel(summary: string): string {
  const normalized = normalizeDiagnosticMessage(summary, "", ". ");
  return `Local-only diagnostic summary preview. ${normalized || "No summary available."}`;
}

export function canStartDiagnosticExport(isMounted: boolean, copyingSummary: boolean, sharingSummary: boolean): boolean {
  return isMounted && !copyingSummary && !sharingSummary;
}

export function canApplyDiagnosticExportResult(isMounted: boolean, requestId: number, currentRequestId: number): boolean {
  return isMounted && requestId > 0 && requestId === currentRequestId;
}

export function getDiagnosticActionState(action: "copy" | "share", copyingSummary: boolean, sharingSummary: boolean): { disabled: boolean; busy: boolean; label: string; hint: string; buttonText: string; icon: "hourglass-top" | "lock-outline" | "content-copy" | "ios-share" } {
  const busy = action === "copy" ? copyingSummary : sharingSummary;
  const blockedByOtherAction = action === "copy" ? sharingSummary : copyingSummary;
  const disabled = busy || blockedByOtherAction;
  return {
    disabled,
    busy,
    label: busy
      ? action === "copy" ? "Copying diagnostic summary" : "Preparing diagnostic summary"
      : blockedByOtherAction
        ? action === "copy" ? "Copy unavailable while sharing" : "Share unavailable while copying"
        : action === "copy" ? "Copy privacy-safe diagnostic summary" : "Share privacy-safe diagnostic summary",
    hint: busy
      ? action === "copy" ? "Copying is in progress; wait for it to finish" : "Preparing the share sheet; wait for it to finish"
      : blockedByOtherAction
        ? action === "copy" ? "Copy becomes available after sharing finishes" : "Share becomes available after copying finishes"
        : action === "copy" ? "Copies counters and status only; no file metadata or contents are included" : "Shares counters and status only; no file metadata or contents are included",
    buttonText: busy
      ? action === "copy" ? "Copying summary…" : "Preparing summary…"
      : blockedByOtherAction
        ? action === "copy" ? "Copy unavailable" : "Share unavailable"
        : action === "copy" ? "Copy privacy-safe summary" : "Share privacy-safe summary",
    icon: busy ? "hourglass-top" : blockedByOtherAction ? "lock-outline" : action === "copy" ? "content-copy" : "ios-share",
  };
}

export function getDiagnosticFeedbackTone(message: string): "success" | "warning" {
  return /could not|canceled|cancelled|not be confirmed/i.test(message) ? "warning" : "success";
}

export function getDiagnosticFeedbackAccessibilityLabel(message: string): string {
  const normalized = normalizeDiagnosticMessage(message);
  if (!normalized) return "Warning. No feedback details available.";
  const presentation = getDiagnosticFeedbackPresentation(normalized);
  return `${presentation.tone === "warning" ? "Warning" : "Success"}. ${normalized}`;
}

export function getDiagnosticFeedbackPresentation(message: string): { tone: "success" | "warning"; icon: "check-circle-outline" | "warning-amber" } {
  const normalized = normalizeDiagnosticMessage(message);
  const tone = normalized ? getDiagnosticFeedbackTone(normalized) : "warning";
  return { tone, icon: getDiagnosticFeedbackIcon(tone) };
}

export function getDiagnosticFeedbackIcon(tone: "success" | "warning"): "check-circle-outline" | "warning-amber" {
  return tone === "warning" ? "warning-amber" : "check-circle-outline";
}

export function getDiagnosticCopyMessage(success: boolean): string {
  return success
    ? "Diagnostic summary copied. No file metadata was included."
    : "The diagnostic summary could not be copied. Your local data was not changed.";
}

export function getDiagnosticShareCompletionState(isMounted: boolean, action: string, sharedAction: string, dismissedAction: string): { sharingSummary: boolean; message: string } | null {
  if (!isMounted) return null;
  return {
    sharingSummary: false,
    message: getDiagnosticShareMessage(action, sharedAction, dismissedAction),
  };
}

export function getDiagnosticShareFailureMessage(): string {
  return "The diagnostic summary could not be shared. Your local data was not changed. Try again if needed.";
}

export function getDiagnosticShareMessage(action: string, sharedAction: string, dismissedAction: string): string {
  if (action === dismissedAction) return "Sharing canceled. Your local data was not changed.";
  if (action === sharedAction) return "Diagnostic summary ready to share. No file metadata was included.";
  return "The share result could not be confirmed. Your local data was not changed.";
}

export function buildPrivacySafeDiagnosticSummary(input: DiagnosticSummaryInput): string {
  const diagnosticMessage = input.lastDiagnosticMessage?.trim()
    ? "A sanitized diagnostic warning is present"
    : "No recorded scan issue";
  return [
    "ClearSpace AI diagnostic summary",
    "Privacy-safe: no file names, paths, media identifiers, or file contents included.",
    `Last scan: ${safeText(input.lastScanLabel, "Not available")}`,
    `Media access: ${safeText(input.permissionReadiness, "Not available")}`,
    `Persistence: ${safeText(input.persistenceStatus, "Not available")}`,
    `Scan timeouts: ${safeCount(input.timeoutCount)}`,
    `Scan cancellations: ${safeCount(input.cancellationCount)}`,
    `Latest diagnostic: ${diagnosticMessage}`,
  ].join("\n");
}
