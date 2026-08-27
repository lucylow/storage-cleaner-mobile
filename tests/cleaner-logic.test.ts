import { describe, expect, it } from "vitest";
import { appendScanHistory, calculateSelectedBytes, canUndoCleanup, createCleanupSummary, formatHistoryDate, formatStorage, getProtectedItems, getRecommendation, isValidScanHistoryEntry, removeSelectedItems, restoreCleanupItems, sanitizeCleanupHistory, sanitizeCleanupItems, sanitizeCleanupSummary, sanitizeScanHistory, selectAllInCategory, setCategorySelection, setItemProtected, toggleCleanupItem } from "../lib/cleaner-logic";
import type { CleanupItem } from "../lib/cleaner-store";
import { aggregateProgress, canApplyScanCallback, chooseScannerMode, classifyPermissionReadiness, getNativePageSize, getScanControlAnnouncement, getScanProgressMilestone, getPermissionReadinessLabel, getPermissionAppActiveAnnouncement, getPermissionRecoveryAnnouncement, getPermissionRefreshAnnouncement, getPermissionRecoveryLabel, getPermissionSettingsHandoffAnnouncement, shouldShowPermissionNotice, canApplyPermissionRefresh, formatScanTimeout, getNextScanTimeout, getScanControlLabel, getScanPhaseLabel, getScanResumeMessage, getScanSessionState, sanitizePersistedScanDiagnostic, sanitizePersistedScanLabel, sanitizeScanDiagnosticCounters, shouldExpireScanSession, mapNativeMediaToCandidates, mergeNativeMediaPage, sanitizeScanDiagnostic, shouldRefreshPermissionOnAppState } from "../lib/scanner-logic";
import { bucketLargeFiles, formatCategoryDetail, formatCategoryReviewHint, groupDuplicateCandidates, summarizeCleanup } from "../lib/analysis-logic";
import { canApplyStorageRefresh, formatBytes, getGuidePersistenceFailureMessage, normalizeStorageInfo } from "../lib/storage-logic";
import { aggregateDeletionResult, canApplyUndoExpiryCallback, canRestoreUndo, canRetryCleanup, canStartCleanup, canStartUndoRestore, chooseDeletionMode, getCleanupCompletionAccessibilityLabel, getCleanupCompletionCopy, getCleanupProgressAccessibilityLabel, getUndoCountdownAccessibilityLabel, isCleanupBlocked, isCleanupPreview, permissionRecoveryMessage } from "../lib/deletion-logic";
import { buildPrivacySafeDiagnosticSummary, canApplyDiagnosticExportResult, canStartDiagnosticExport, formatDiagnosticCount, getDiagnosticHydrationRecoveryMessage, hasSanitizedDiagnosticCounters, hydrateDiagnosticCounters, getDiagnosticActionState, getDiagnosticMetricAccessibilityLabel, getDiagnosticCopyMessage, getDiagnosticCopyState, getDiagnosticFeedbackAccessibilityLabel, getDiagnosticFeedbackIcon, getDiagnosticFeedbackPresentation, getDiagnosticFeedbackTone, getDiagnosticPreviewAccessibilityLabel, getDiagnosticPreviewState, getDiagnosticShareCompletionState, getDiagnosticShareFailureMessage, getDiagnosticStatusAccessibilityLabel, getDiagnosticStatusRowAccessibilityLabel, normalizeDiagnosticMessage, getDiagnosticStatusPresentation, getDiagnosticShareMessage } from "../lib/diagnostic-logic";
import { canRestorePurchase, canShowUpgradePrompt, canStartPurchase, getComparisonRows, getManageSubscriptionMessage, getPlanDetails, getPremiumPrompt, getPurchaseButtonLabel, getPurchaseMessage, getPurchaseResult, getRestoreResult, getSavingsLabel, getUpgradeIntentMessage, getValueReminder, isPremiumFeatureAvailable } from "../lib/monetization-logic";
import { isValidEntitlement, isValidPromptState } from "../lib/premium-store";
import { enqueuePreferenceWrite, getThemePreferenceRecoveryMessage, mergeThemePreferences, resolveThemePreferences } from "../lib/theme-logic";
import { canApplyPersistenceRetryCallback, getHydrationFailureMessage, getPersistenceRetryActionCopy, getPersistenceRetryTimeoutMessage, getPersistenceStatusIcon, getPersistenceStatusTone, getPersistenceStatusValue, hasPersistenceRetryTimedOut, isLatestPersistenceWrite, shouldClearPersistenceWarningAfterWrite, PERSISTENCE_RETRY_TIMEOUT_MS } from "../lib/persistence-logic";

const items: CleanupItem[] = [
  { id: "a", name: "a.jpg", location: "Photos", size: 18.4, category: "duplicates", selected: true },
  { id: "b", name: "b.mp4", location: "Videos", size: 842, category: "large", selected: false },
  { id: "c", name: "cache", location: "System", size: 126, category: "temporary", selected: true },
];

describe("Cleaner logic", () => {
  it("describes theme preference recovery without exposing local data", () => {
    expect(getThemePreferenceRecoveryMessage()).toBe("Appearance preferences could not be saved locally. Your files were not affected.");
    expect(getThemePreferenceRecoveryMessage()).not.toMatch(/\/|\\|\.jpg|\.mp4/i);
  });

  it("describes malformed persisted state without exposing local data", () => {
    expect(getHydrationFailureMessage()).toBe("Saved local state was invalid. Safe defaults are in use; your files were not affected.");
    expect(getHydrationFailureMessage()).not.toMatch(/\/|\\|\.jpg|\.mp4/i);
    expect(shouldClearPersistenceWarningAfterWrite(true)).toBe(false);
    expect(shouldClearPersistenceWarningAfterWrite(false)).toBe(true);
    expect(canApplyScanCallback(true, false)).toBe(true);
    expect(canApplyScanCallback(false, false)).toBe(false);
    expect(canApplyScanCallback(true, true)).toBe(false);
    expect(canApplyUndoExpiryCallback(true)).toBe(true);
    expect(canApplyUndoExpiryCallback(false)).toBe(false);
    expect(canApplyPersistenceRetryCallback(true)).toBe(true);
    expect(canApplyPersistenceRetryCallback(false)).toBe(false);
  });
  it("describes permission status after returning to the app without exposing local data", () => {
    expect(getPermissionAppActiveAnnouncement("granted")).toBe("Media access is ready again. You can continue your local scan.");
    expect(getPermissionAppActiveAnnouncement("blocked")).toBe("Media access is still blocked in Settings. Your files were not changed.");
    expect(getPermissionAppActiveAnnouncement("requestable")).toBe("Media access still needs approval. Your files were not changed.");
    expect(getPermissionAppActiveAnnouncement("unsupported")).toBe("Native media access is unavailable here. Your files were not changed.");
    expect(getPermissionAppActiveAnnouncement("blocked")).not.toMatch(/\/|\\|\.jpg|\.mp4/i);
  });

  it("describes the Settings handoff without exposing local data", () => {
    expect(getPermissionSettingsHandoffAnnouncement("open-settings")).toBe("Device Settings opened. Review media access, then return here to check again.");
    expect(getPermissionSettingsHandoffAnnouncement("unsupported")).toBe("Device Settings recovery is unavailable here. Your files were not changed.");
    expect(getPermissionSettingsHandoffAnnouncement("failed")).toBe("Device Settings could not be opened. You can retry safely.");
    expect(getPermissionSettingsHandoffAnnouncement("open-settings")).not.toMatch(/\/|\\|\.jpg|\.mp4/i);
  });

  it("keeps a dismissed notice hidden until its message changes", () => {
    const blockedMessage = getPermissionAppActiveAnnouncement("blocked");
    expect(shouldShowPermissionNotice(blockedMessage, null)).toBe(true);
    expect(shouldShowPermissionNotice(blockedMessage, blockedMessage)).toBe(false);
    const grantedMessage = getPermissionAppActiveAnnouncement("granted");
    expect(shouldShowPermissionNotice(grantedMessage, blockedMessage)).toBe(true);
    expect(shouldShowPermissionNotice(null, blockedMessage)).toBe(false);
    expect(shouldShowPermissionNotice("", null)).toBe(false);
  });

  it("describes permission refresh outcomes without exposing local data", () => {
    expect(getPermissionRefreshAnnouncement("refreshed")).toBe("Media access status refreshed. You can retry the local scan.");
    expect(getPermissionRefreshAnnouncement("failed")).toBe("Media access could not be checked. You can retry safely.");
    expect(getPermissionRefreshAnnouncement("failed")).not.toMatch(/\/|\\|\.jpg|\.mp4/i);
  });

  it("uses privacy-safe announcements for scan control transitions", () => {
    expect(getScanControlAnnouncement("paused")).toBe("Scan paused safely. No files were changed.");
    expect(getScanControlAnnouncement("backgrounded")).toBe("Scan paused safely because the app went to the background.");
    expect(getScanControlAnnouncement("resumed")).toBe("Scan resumed safely. Local analysis is continuing.");
    expect(getScanControlAnnouncement("cancelled")).toBe("Scan cancelled safely. No files were changed.");
    expect(getScanControlAnnouncement("cancelled")).not.toMatch(/\/|\\|\.jpg|\.mp4/i);
  });

  it("announces scan progress at bounded milestones without exposing file metadata", () => {
    expect(getScanProgressMilestone(Number.NaN)).toBe(0);
    expect(getScanProgressMilestone(-10)).toBe(0);
    expect(getScanProgressMilestone(24.9)).toBe(0);
    expect(getScanProgressMilestone(25)).toBe(25);
    expect(getScanProgressMilestone(49.9)).toBe(25);
    expect(getScanProgressMilestone(50)).toBe(50);
    expect(getScanProgressMilestone(74.9)).toBe(50);
    expect(getScanProgressMilestone(75)).toBe(75);
    expect(getScanProgressMilestone(99.9)).toBe(75);
    expect(getScanProgressMilestone(100)).toBe(100);
    expect(getScanProgressMilestone(140)).toBe(100);
  });

  it("blocks background timeout recovery after provider unmount", () => {
    expect(shouldExpireScanSession(1000, 61_000, 60_000)).toBe(true);
    expect(canApplyScanCallback(true, false)).toBe(true);
    expect(canApplyScanCallback(false, false)).toBe(false);
    expect(canApplyPermissionRefresh(4, 4, true)).toBe(true);
    expect(canApplyPermissionRefresh(3, 4, true)).toBe(false);
    expect(canApplyPermissionRefresh(4, 4, false)).toBe(false);
  });

  it("distinguishes shared and canceled diagnostic summaries safely", () => {
    expect(getDiagnosticShareMessage("sharedAction", "sharedAction", "dismissedAction")).toBe("Diagnostic summary ready to share. No file metadata was included.");
    expect(getDiagnosticShareMessage("dismissedAction", "sharedAction", "dismissedAction")).toBe("Sharing canceled. Your local data was not changed.");
    expect(getDiagnosticShareMessage("unknownAction", "sharedAction", "dismissedAction")).toBe("The share result could not be confirmed. Your local data was not changed.");
    expect(getDiagnosticShareFailureMessage()).toBe("The diagnostic summary could not be shared. Your local data was not changed. Try again if needed.");
    expect(getDiagnosticShareCompletionState(true, "sharedAction", "sharedAction", "dismissedAction")).toEqual({ sharingSummary: false, message: "Diagnostic summary ready to share. No file metadata was included." });
    expect(getDiagnosticShareCompletionState(false, "sharedAction", "sharedAction", "dismissedAction")).toBeNull();
    expect(getDiagnosticCopyMessage(true)).toBe("Diagnostic summary copied. No file metadata was included.");
    expect(getDiagnosticCopyMessage(false)).toBe("The diagnostic summary could not be copied. Your local data was not changed.");
    expect(getDiagnosticCopyState(true, true)).toEqual({ copyingSummary: false, message: "Diagnostic summary copied. No file metadata was included." });
    expect(getDiagnosticCopyState(true, false)).toEqual({ copyingSummary: false, message: "The diagnostic summary could not be copied. Your local data was not changed." });
    expect(getDiagnosticCopyState(false, true)).toBeNull();
    expect(getDiagnosticFeedbackTone("Diagnostic summary copied. No file metadata was included.")).toBe("success");
    expect(getDiagnosticFeedbackTone("Sharing canceled. Your local data was not changed.")).toBe("warning");
    expect(getDiagnosticFeedbackTone("The share result could not be confirmed. Your local data was not changed.")).toBe("warning");
    expect(getDiagnosticFeedbackIcon("success")).toBe("check-circle-outline");
    expect(getDiagnosticFeedbackIcon("warning")).toBe("warning-amber");
    expect(getDiagnosticFeedbackPresentation("Diagnostic summary copied. No file metadata was included.")).toEqual({ tone: "success", icon: "check-circle-outline" });
    expect(getDiagnosticFeedbackPresentation("Sharing canceled. Your local data was not changed.")).toEqual({ tone: "warning", icon: "warning-amber" });
    expect(getDiagnosticFeedbackPresentation("   ")).toEqual({ tone: "warning", icon: "warning-amber" });
    expect(getDiagnosticFeedbackAccessibilityLabel("Diagnostic summary copied. No file metadata was included.")).toBe("Success. Diagnostic summary copied. No file metadata was included.");
    expect(getDiagnosticFeedbackAccessibilityLabel("Sharing canceled. Your local data was not changed.")).toBe("Warning. Sharing canceled. Your local data was not changed.");
    expect(getDiagnosticFeedbackAccessibilityLabel("  Sharing canceled.\nYour local data was not changed.  ")).toBe("Warning. Sharing canceled. Your local data was not changed.");
    expect(getDiagnosticFeedbackAccessibilityLabel("   ")).toBe("Warning. No feedback details available.");
    expect(canStartDiagnosticExport(true, false, false)).toBe(true);
    expect(canStartDiagnosticExport(false, false, false)).toBe(false);
    expect(canStartDiagnosticExport(true, true, false)).toBe(false);
    expect(canStartDiagnosticExport(true, false, true)).toBe(false);
    expect(canApplyDiagnosticExportResult(true, 2, 2)).toBe(true);
    expect(canApplyDiagnosticExportResult(true, 1, 2)).toBe(false);
    expect(canApplyDiagnosticExportResult(false, 2, 2)).toBe(false);
    expect(canApplyDiagnosticExportResult(true, 0, 0)).toBe(false);
    expect(getDiagnosticActionState("copy", false, false)).toEqual({ disabled: false, busy: false, label: "Copy privacy-safe diagnostic summary", hint: "Copies counters and status only; no file metadata or contents are included", buttonText: "Copy privacy-safe summary", icon: "content-copy" });
    expect(getDiagnosticActionState("copy", true, false)).toEqual({ disabled: true, busy: true, label: "Copying diagnostic summary", hint: "Copying is in progress; wait for it to finish", buttonText: "Copying summary…", icon: "hourglass-top" });
    expect(getDiagnosticActionState("share", false, true)).toEqual({ disabled: true, busy: true, label: "Preparing diagnostic summary", hint: "Preparing the share sheet; wait for it to finish", buttonText: "Preparing summary…", icon: "hourglass-top" });
    expect(getDiagnosticActionState("share", true, false)).toEqual({ disabled: true, busy: false, label: "Share unavailable while copying", hint: "Share becomes available after copying finishes", buttonText: "Share unavailable", icon: "lock-outline" });
    expect(getDiagnosticActionState("copy", false, true)).toEqual({ disabled: true, busy: false, label: "Copy unavailable while sharing", hint: "Copy becomes available after sharing finishes", buttonText: "Copy unavailable", icon: "lock-outline" });
    expect(formatDiagnosticCount(Number.POSITIVE_INFINITY)).toBe("0");
    expect(formatDiagnosticCount(-4)).toBe("0");
    expect(formatDiagnosticCount(1_000_001)).toBe("1,000,000");
    expect(getDiagnosticHydrationRecoveryMessage()).toContain("No file data was affected");
    expect(hasSanitizedDiagnosticCounters({ timeoutCount: -1, cancellationCount: 0 })).toBe(true);
    expect(hasSanitizedDiagnosticCounters({ timeoutCount: 1, cancellationCount: 2 })).toBe(false);
    expect(hydrateDiagnosticCounters({ timeoutCount: -1, cancellationCount: 1.8 })).toEqual({ timeoutCount: 0, cancellationCount: 1, recovered: true });
    expect(hydrateDiagnosticCounters(undefined)).toEqual({ timeoutCount: 0, cancellationCount: 0, recovered: false });
    expect(getDiagnosticMetricAccessibilityLabel("Timeouts", 3)).toBe("Timeouts: 3");
    expect(getDiagnosticMetricAccessibilityLabel("  Cancellations  ", Number.NaN)).toBe("Cancellations: 0");
    expect(getDiagnosticStatusRowAccessibilityLabel("Persistence", "Saving locally", "Local save is in progress.")).toBe("Persistence: Local save is in progress.");
    expect(getDiagnosticStatusRowAccessibilityLabel("  ", "")).toBe("Status: Unavailable");
    expect(normalizeDiagnosticMessage("Line one\nLine two")).toBe("Line one Line two");
    expect(normalizeDiagnosticMessage("Line one\nLine two", "", ". ")).toBe("Line one. Line two");
    expect(getDiagnosticPreviewAccessibilityLabel("Line one\nLine two")).toBe("Local-only diagnostic summary preview. Line one. Line two");
    expect(getDiagnosticPreviewAccessibilityLabel("  Privacy-safe   summary  ")).toBe("Local-only diagnostic summary preview. Privacy-safe summary");
    expect(getDiagnosticPreviewAccessibilityLabel("   ")).toBe("Local-only diagnostic summary preview. No summary available.");
    expect(getDiagnosticPreviewState(false)).toEqual({ expanded: false, label: "Preview diagnostic summary", hint: "Shows the exact local-only summary before copying or sharing", buttonText: "Preview summary", icon: "visibility" });
    expect(getDiagnosticPreviewState(true)).toEqual({ expanded: true, label: "Hide diagnostic summary preview", hint: "Closes the local-only preview", buttonText: "Hide summary preview", icon: "visibility-off" });
    expect(getDiagnosticStatusPresentation(false)).toEqual({ title: "No recorded scan issue", message: "The latest local scan completed without a sanitized diagnostic warning.", icon: "check-circle-outline", tone: "success" });
    expect(getDiagnosticStatusPresentation(true)).toEqual({ title: "Scan needs attention", message: "A sanitized diagnostic warning is present.", icon: "info-outline", tone: "warning" });
    expect(getDiagnosticStatusAccessibilityLabel(getDiagnosticStatusPresentation(false))).toBe("Local-only diagnostic status. Success. No recorded scan issue. The latest local scan completed without a sanitized diagnostic warning.");
    expect(getDiagnosticStatusAccessibilityLabel({ title: "Scan needs attention", message: "A sanitized diagnostic warning is present.", tone: "warning" })).toBe("Local-only diagnostic status. Warning. Scan needs attention. A sanitized diagnostic warning is present.");
    expect(getDiagnosticStatusAccessibilityLabel({ title: "  ", message: "Line one\n  Line two  " })).toBe("Local-only diagnostic status. Success. Diagnostic status. Line one Line two");
  });

  it("builds a privacy-safe diagnostic summary without file metadata", () => {
    const summary = buildPrivacySafeDiagnosticSummary({
      timeoutCount: 2.8,
      cancellationCount: -1,
      lastScanLabel: "Today\n10:30",
      permissionReadiness: "Ready",
      persistenceStatus: "Available",
      lastDiagnosticMessage: "No file names or /private/path values\nare retained",
    });

    expect(summary).toContain("Privacy-safe: no file names, paths, media identifiers, or file contents included.");
    expect(summary).toContain("Scan timeouts: 2");
    expect(summary).toContain("Scan cancellations: 0");
    expect(summary).toContain("Last scan: Today 10:30");
    expect(summary).toContain("Latest diagnostic: A sanitized diagnostic warning is present");
    expect(summary).not.toContain("/private/path");
    const unsafeSummary = buildPrivacySafeDiagnosticSummary({ timeoutCount: 0, cancellationCount: 0, lastScanLabel: "/private/very-long-path/" + "x".repeat(200), permissionReadiness: "Ready", persistenceStatus: "Available" });
    expect(unsafeSummary).toContain("[redacted]");
    expect(unsafeSummary.length).toBeLessThan(700);
    expect(summary).not.toContain("\nare retained");
  });

  it("sanitizes persisted cleanup items without retaining malformed records", () => {
    const valid = { id: "safe-1", name: "Photo.jpg", location: "Photos", size: 12, category: "duplicates", selected: true };
    expect(sanitizeCleanupItems([valid, { ...valid, id: "" }, { ...valid, id: "   " }, { ...valid, name: "x".repeat(257) }, { ...valid, location: "x".repeat(257) }, { ...valid, size: Number.NaN }, { ...valid, category: "unknown" }, { ...valid, selected: "yes" }])).toEqual([valid]);
    expect(sanitizeCleanupItems([valid, { ...valid, id: "safe-2" }], 1)).toHaveLength(1);
    expect(sanitizeCleanupItems([valid, { ...valid, name: "Duplicate record" }])).toEqual([valid]);
    expect(sanitizeCleanupItems([{ ...valid, id: "protected-1", protected: true, selected: true }])).toEqual([{ ...valid, id: "protected-1", protected: true, selected: false }]);
    expect(sanitizeCleanupItems({ items: [valid] })).toEqual([]);
  });

  it("sanitizes persisted cleanup summaries without retaining invalid totals", () => {
    expect(sanitizeCleanupSummary({ reclaimedBytes: 42.5, itemCount: 3 })).toEqual({ reclaimedBytes: 42.5, itemCount: 3 });
    expect(sanitizeCleanupSummary({ reclaimedBytes: Number.NaN, itemCount: 3 })).toBeNull();
    expect(sanitizeCleanupSummary({ reclaimedBytes: -1, itemCount: 3 })).toBeNull();
    expect(sanitizeCleanupSummary({ reclaimedBytes: 42, itemCount: 1.5 })).toBeNull();
    expect(sanitizeCleanupSummary({ reclaimedBytes: 42, itemCount: -1 })).toBeNull();
    expect(sanitizeCleanupSummary(null)).toBeNull();
  });

  it("blocks repeated cleanup execution while a prior action is in flight", () => {
    expect(canStartCleanup(false)).toBe(true);
    expect(canStartCleanup(true)).toBe(false);
  });

  it("keeps cleanup progress announcements concise and safe", () => {
    expect(getCleanupProgressAccessibilityLabel(true)).toContain("Cleanup in progress");
    expect(getCleanupProgressAccessibilityLabel(true)).toContain("processed safely");
    expect(getCleanupProgressAccessibilityLabel(false)).toBe("Cleanup is ready for confirmation.");
  });

  it("describes each cleanup completion outcome clearly", () => {
    expect(getCleanupCompletionAccessibilityLabel("deleted", 2, "144 MB")).toContain("Cleanup complete");
    expect(getCleanupCompletionAccessibilityLabel("partial", 2, "42 MB")).toContain("partially completed");
    expect(getCleanupCompletionAccessibilityLabel("permission-denied", 2, "0 MB")).toContain("left unchanged");
    expect(getCleanupCompletionAccessibilityLabel("unsupported", 2, "0 MB")).toContain("Preview cleanup only");
    expect(getCleanupCompletionAccessibilityLabel(undefined, 0, "0 MB")).toBe("Cleanup finished. No files were changed.");
    expect(getCleanupCompletionCopy("unsupported", 2).title).toContain("Preview only");
    expect(getCleanupCompletionCopy("deleted", 2).title).toContain("lighter");
    expect(isCleanupPreview("unsupported")).toBe(true);
    expect(isCleanupBlocked("partial")).toBe(true);
  });

  it("keeps undo countdown announcements bounded and singular-aware", () => {
    expect(getUndoCountdownAccessibilityLabel(10)).toBe("Undo available for 10 seconds.");
    expect(getUndoCountdownAccessibilityLabel(1)).toBe("Undo available for 1 second.");
    expect(getUndoCountdownAccessibilityLabel(999)).toBe("Undo available for 30 seconds.");
    expect(getUndoCountdownAccessibilityLabel(0)).toBe("Undo window has expired.");
  });

  it("rejects stale or malformed undo restoration windows", () => {
    expect(canRestoreUndo(1_000, 1_001)).toBe(true);
    expect(canRestoreUndo(1_001, 1_001)).toBe(false);
    expect(canRestoreUndo(2_000, 1_000)).toBe(false);
    expect(canRestoreUndo(Number.NaN, 2_000)).toBe(false);
    expect(canRestoreUndo(1_000, null)).toBe(false);
  });

  it("sanitizes cleanup history without retaining malformed or duplicate entries", () => {
    const valid = { id: "cleanup-1", completedAt: 1_700_000_000_000, reclaimedBytes: 42, itemCount: 2, status: "completed" as const, undoAvailable: true };
    expect(sanitizeCleanupHistory([valid, { ...valid, id: "cleanup-2" }, { ...valid, id: "cleanup-1", reclaimedBytes: 999 }, { ...valid, id: "bad-time", completedAt: Number.NaN }, { ...valid, id: "bad-status", status: "unknown" as never }, { ...valid, id: "   " }], 2)).toEqual([valid, { ...valid, id: "cleanup-2" }]);
    expect(sanitizeCleanupHistory(null)).toEqual([]);
  });

  it("formats megabytes and gigabytes consistently", () => {
    expect(formatStorage(144.4)).toBe("144.4 MB");
    expect(formatHistoryDate("unsafe")).toBe("Date unavailable");
    expect(formatHistoryDate(Number.POSITIVE_INFINITY)).toBe("Date unavailable");
    expect(formatHistoryDate(-1)).toBe("Date unavailable");
    expect(formatStorage(1000)).toBe("1.0 GB");
  });

  it("calculates only selected item sizes", () => {
    expect(calculateSelectedBytes(items)).toBe(144.4);
  });

  it("toggles one item without changing the rest", () => {
    const next = toggleCleanupItem(items, "b");
    expect(next.find((item) => item.id === "b")?.selected).toBe(true);
    expect(next.find((item) => item.id === "a")?.selected).toBe(true);
  });

  it("selects every item in one category", () => {
    const next = selectAllInCategory(items, "large");
    expect(next.find((item) => item.id === "b")?.selected).toBe(true);
  });

  it("removes selected items and keeps unselected items", () => {
    expect(removeSelectedItems(items).map((item) => item.id)).toEqual(["b"]);
  });

  it("restores only missing items during the local undo window", () => {
    const remaining = items.filter((item) => item.id === "b");
    expect(restoreCleanupItems(remaining, [items[0], items[2], items[2]]).map((item) => item.id)).toEqual(["b", "a", "c"]);
    expect(restoreCleanupItems([], [{ ...items[0], protected: true }])).toEqual([]);
    expect(restoreCleanupItems([], [{ ...items[0], id: "oversized", name: "x".repeat(257) }])).toEqual([]);
    expect(restoreCleanupItems([], [{ ...items[0], id: "protected-stale", protected: true, selected: true }])).toEqual([]);
    expect(canUndoCleanup("fallback", "unsupported")).toBe(true);
    expect(canUndoCleanup("native", "deleted")).toBe(false);
    expect(canUndoCleanup("fallback", "failed")).toBe(false);
  });

  it("creates an accurate cleanup summary", () => {
    expect(createCleanupSummary(items)).toEqual({ reclaimedBytes: 144.4, itemCount: 2 });
    expect(createCleanupSummary(items.filter((item) => !item.selected))).toEqual({ reclaimedBytes: 0, itemCount: 0 });
  });

  it("prepends new history entries and keeps a bounded list", () => {
    const history = Array.from({ length: 10 }, (_, index) => ({ id: `old-${index}`, scannedAt: index, reclaimableBytes: index, itemCount: index }));
    const next = appendScanHistory(history, { id: "new", scannedAt: 11, reclaimableBytes: 42, itemCount: 2 });
    expect(next).toHaveLength(10);
    expect(next[0].id).toBe("new");
    expect(next.at(-1)?.id).toBe("old-8");
    expect(appendScanHistory(history, { id: "old-3", scannedAt: 12, reclaimableBytes: 42, itemCount: 2 })).toHaveLength(10);
    expect(appendScanHistory(history, { id: "old-3", scannedAt: 12, reclaimableBytes: 42, itemCount: 2 })[0].id).toBe("old-3");
    expect(appendScanHistory(history, { id: "newer", scannedAt: 12, reclaimableBytes: 42, itemCount: 2 }, -1)).toEqual([]);
    expect(appendScanHistory(history, { id: "", scannedAt: -1, reclaimableBytes: -4, itemCount: 1 })).toEqual(history);
  });

  it("filters malformed history entries before rendering", () => {
    const valid = { id: "ok", scannedAt: 10, reclaimableBytes: 25, itemCount: 1 };
    expect(isValidScanHistoryEntry(valid)).toBe(true);
    expect(isValidScanHistoryEntry({ ...valid, reclaimableBytes: -1 })).toBe(false);
    expect(isValidScanHistoryEntry({ ...valid, id: "" })).toBe(false);
    expect(isValidScanHistoryEntry({ ...valid, scannedAt: -1 })).toBe(false);
    expect(sanitizeScanHistory([valid, { id: "bad" }, { ...valid, id: "   " }, null, { ...valid, itemCount: 1.5 }, { ...valid, reclaimableBytes: 99 }])).toEqual([valid]);
    expect(sanitizePersistedScanDiagnostic({ code: "permission-denied", message: "file:///private/photo.jpg" })).toEqual(sanitizeScanDiagnostic("permission-denied"));
    expect(sanitizePersistedScanDiagnostic({ code: "unknown", message: "unsafe path" })).toEqual(sanitizeScanDiagnostic("unknown"));
    expect(sanitizePersistedScanDiagnostic({ code: "not-a-code", message: "anything" })).toBeNull();
    expect(sanitizePersistedScanLabel("Cleaned just now")).toBe("Cleaned just now");
    expect(sanitizePersistedScanLabel("file:///private/photo.jpg")).toBe("Never scanned");
    expect(sanitizePersistedScanLabel(null)).toBe("Never scanned");
  });

  it("chooses fallback scanning on web and native scanning when available", () => {
    expect(chooseScannerMode("web", true)).toBe("fallback");
    expect(chooseScannerMode("ios", true)).toBe("native");
    expect(chooseScannerMode("android", false)).toBe("fallback");
  });

  it("merges paginated native media without duplicating overlapping assets", () => {
    const firstPage = [{ id: "one", filename: "one.jpg", uri: "file://one", sizeBytes: 1, mediaType: "photo" as const }];
    const secondPage = [{ id: "one", filename: "one.jpg", uri: "file://one", sizeBytes: 1, mediaType: "photo" as const }, { id: "two", filename: "two.jpg", uri: "file://two", sizeBytes: 2, mediaType: "photo" as const }];
    expect(mergeNativeMediaPage(firstPage, secondPage).map((record) => record.id)).toEqual(["one", "two"]);
  });

  it("cycles configurable timeout values and sanitizes diagnostic counters", () => {
    expect(formatScanTimeout(60_000)).toBe("1 minute");
    expect(getNextScanTimeout(60_000)).toBe(120_000);
    expect(getNextScanTimeout(300_000)).toBe(60_000);
    expect(sanitizeScanDiagnosticCounters({ timeoutCount: 2.8, cancellationCount: -4 })).toEqual({ timeoutCount: 2, cancellationCount: 0 });
    expect(sanitizeScanDiagnosticCounters({ timeoutCount: "paths", cancellationCount: null })).toEqual({ timeoutCount: 0, cancellationCount: 0 });
    expect(sanitizeScanDiagnosticCounters({ timeoutCount: Number.MAX_SAFE_INTEGER, cancellationCount: 2_000_000 })).toEqual({ timeoutCount: 1_000_000, cancellationCount: 1_000_000 });
  });

  it("handles resume messaging and abandoned-session timeout eligibility safely", () => {
    expect(getScanResumeMessage("backgrounded")).toContain("paused safely");
    expect(getScanResumeMessage("paused")).toContain("Resume");
    expect(shouldExpireScanSession(1000, 121000, 120000)).toBe(true);
    expect(shouldExpireScanSession(null, 121000, 120000)).toBe(false);
  });

  it("classifies scan session state without retaining sensitive identifiers", () => {
    expect(getScanSessionState("active", true, false)).toBe("running");
    expect(getScanSessionState("active", true, true)).toBe("paused");
    expect(getScanSessionState("background", true, false)).toBe("backgrounded");
    expect(getScanSessionState("active", false, false)).toBe("idle");
  });

  it("labels pause, resume, and inactive scan controls safely", () => {
    expect(getScanControlLabel(true, false)).toBe("Pause scan");
    expect(getScanControlLabel(true, true)).toBe("Resume scan");
    expect(getScanControlLabel(false, false)).toBe("Start scan");
  });

  it("selects smaller native batches as the scan grows", () => {
    expect(getNativePageSize(0, 0)).toBe(50);
    expect(getNativePageSize(3, 150)).toBe(50);
    expect(getNativePageSize(4, 200)).toBe(25);
    expect(getNativePageSize(10, 399)).toBe(25);
    expect(getNativePageSize(11, 400)).toBe(10);
  });

  it("classifies permission readiness without exposing platform details", () => {
    expect(classifyPermissionReadiness({ granted: true, canAskAgain: false }, "ios")).toBe("granted");
    expect(classifyPermissionReadiness({ granted: false, canAskAgain: true }, "android")).toBe("requestable");
    expect(classifyPermissionReadiness({ granted: false, canAskAgain: false }, "android")).toBe("blocked");
    expect(classifyPermissionReadiness({ granted: false, canAskAgain: true }, "web")).toBe("unsupported");
    expect(getPermissionReadinessLabel("blocked")).toContain("Settings");
    expect(getPermissionRecoveryLabel("open-settings")).toContain("Opening");
    expect(getPermissionRecoveryLabel("unsupported")).toContain("unavailable");
    expect(getPermissionRecoveryLabel("failed")).toContain("Could not");
    expect(getPermissionRecoveryAnnouncement("granted")).toContain("scan this device locally");
    expect(getPermissionRecoveryAnnouncement("requested-denied")).toContain("files were not changed");
    expect(getPermissionRecoveryAnnouncement("open-settings")).toContain("Device Settings opened");
    expect(getPermissionRecoveryAnnouncement("unsupported")).not.toMatch(/\/|\\|\.jpg|\.mp4/i);
    expect(shouldRefreshPermissionOnAppState("background", "active")).toBe(true);
    expect(shouldRefreshPermissionOnAppState("inactive", "active")).toBe(true);
    expect(shouldRefreshPermissionOnAppState("active", "active")).toBe(false);
  });

  it("sanitizes scan diagnostics without exposing file details", () => {
    expect(sanitizeScanDiagnostic("permission-denied", "file:///private/photo.jpg")).toEqual({ code: "permission-denied", message: "Media permission was not granted. No files were changed." });
    expect(sanitizeScanDiagnostic("media-read-failed")).toEqual({ code: "media-read-failed", message: "Some on-device media could not be read. You can retry safely." });
    expect(sanitizeScanDiagnostic("unknown", "secret/path.jpg").message).not.toContain("secret");
  });

  it("labels scan phases and cancellation safely", () => {
    expect(getScanPhaseLabel(0, "Preparing local scan")).toBe("Preparing local scan");
    expect(getScanPhaseLabel(45, "Reading media page 2")).toBe("Reading on-device data");
    expect(getScanPhaseLabel(75, "Analyzing media signatures locally")).toBe("Analyzing locally");
    expect(getScanPhaseLabel(0, "Scan cancelled")).toBe("Cancelled safely");
    expect(getScanPhaseLabel(100, "Cleanup opportunities found")).toBe("Ready to review");
    expect(getScanPhaseLabel(Number.NaN, "Analyzing media signatures locally")).toBe("Preparing local scan");
    expect(getScanPhaseLabel(Number.POSITIVE_INFINITY, "Analyzing media signatures locally")).toBe("Preparing local scan");
  });

  it("keeps scan progress and discovered counts monotonic", () => {
    expect(aggregateProgress({ progress: 60, category: "Large files", discoveredItems: 3 }, { progress: 40, category: "Photos", discoveredItems: 2 })).toEqual({ progress: 60, category: "Photos", discoveredItems: 3 });
    expect(aggregateProgress({ progress: Number.NaN, category: "Preparing", discoveredItems: Number.NaN }, { progress: Number.POSITIVE_INFINITY, category: "  ", discoveredItems: -2 })).toEqual({ progress: 0, category: "Preparing", discoveredItems: 0 });
  });

  it("groups duplicate candidates by signature", () => {
    const groups = groupDuplicateCandidates([{ id: "1", name: "a.jpg", size: 10, signature: "same" }, { id: "2", name: "a-copy.jpg", size: 10, signature: "same" }, { id: "3", name: "b.jpg", size: 20, signature: "unique" }]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("prefers local content signatures over filename heuristics", () => {
    const sameContent = mapNativeMediaToCandidates([
      { id: "one", filename: "photo.jpg", uri: "file://one", sizeBytes: 10, mediaType: "photo", contentSignature: "abc" },
      { id: "two", filename: "photo copy.jpg", uri: "file://two", sizeBytes: 10, mediaType: "photo", contentSignature: "abc" },
      { id: "three", filename: "photo copy.jpg", uri: "file://three", sizeBytes: 10, mediaType: "photo", contentSignature: "different" },
    ]);
    expect(sameContent.map((item) => item.category)).toEqual(["duplicates", "duplicates", "large"]);
    expect(mapNativeMediaToCandidates([
      { id: "fallback-one", filename: "photo.jpg", uri: "file://one", sizeBytes: 10, mediaType: "photo" },
      { id: "fallback-two", filename: "photo copy.jpg", uri: "file://two", sizeBytes: 10, mediaType: "photo" },
    ]).map((item) => item.category)).toEqual(["duplicates", "duplicates"]);
  });

  it("buckets large files from largest to smallest", () => {
    expect(bucketLargeFiles([{ id: "a", name: "a", size: 400, signature: "a" }, { id: "b", name: "b", size: 900, signature: "b" }, { id: "c", name: "c", size: 600, signature: "c" }], 500).map((item) => item.id)).toEqual(["b", "c"]);
  });

  it("summarizes category totals and selected totals", () => {
    expect(summarizeCleanup(items)).toEqual([{ category: "duplicates", itemCount: 1, reclaimableBytes: 18.4, selectedBytes: 18.4 }, { category: "large", itemCount: 1, reclaimableBytes: 842, selectedBytes: 0 }, { category: "temporary", itemCount: 1, reclaimableBytes: 126, selectedBytes: 126 }]);
  });

  it("keeps one duplicate original when selecting a category", () => {
    const duplicateItems: CleanupItem[] = [{ id: "one", name: "one", location: "Photos", size: 10, category: "duplicates", selected: false }, { id: "two", name: "two", location: "Photos", size: 10, category: "duplicates", selected: false }];
    const next = setCategorySelection(duplicateItems, "duplicates", true);
    expect(next.map((item) => item.selected)).toEqual([false, true]);
    expect(getRecommendation(next[0], next)).toBe("Keep one original");
    expect(getRecommendation(next[1], next)).toBe("Likely duplicate");
  });

  it("excludes protected items from totals and cleanup removal", () => {
    const protectedItems: CleanupItem[] = [{ ...items[0], selected: true, protected: true }, { ...items[1], selected: true }];
    expect(calculateSelectedBytes(protectedItems)).toBe(842);
    expect(createCleanupSummary(protectedItems)).toEqual({ reclaimedBytes: 842, itemCount: 1 });
    const retained = removeSelectedItems(protectedItems);
    expect(retained.map((item) => item.id)).toEqual(["a"]);
    expect(retained[0].selected).toBe(false);
    expect(getRecommendation(protectedItems[0], protectedItems)).toContain("Protected");
  });

  it("filters protected files and unlocks one item without selecting it", () => {
    const protectedItems: CleanupItem[] = [{ ...items[0], protected: true, selected: true }, { ...items[1], protected: true, selected: false }];
    expect(getProtectedItems(protectedItems).map((item) => item.id)).toEqual(["a", "b"]);
    expect(setItemProtected(protectedItems, "a", false)[0]).toMatchObject({ id: "a", protected: false, selected: false });
  });

  it("applies the large-file threshold to summaries and recommendations", () => {
    expect(summarizeCleanup(items, 500).find((summary) => summary.category === "large")).toMatchObject({ itemCount: 1, reclaimableBytes: 842 });
    expect(getRecommendation(items[1], items, 1000)).toBe("Below threshold");
  });

  it("maps native media metadata into safe cleanup candidates", () => {
    const candidates = mapNativeMediaToCandidates([
      { id: "1", filename: "IMG_1.JPG", uri: "file://1", sizeBytes: 18.4 * 1024 * 1024, mediaType: "photo" },
      { id: "2", filename: "IMG_1 copy.JPG", uri: "file://2", sizeBytes: 18.4 * 1024 * 1024, mediaType: "photo" },
      { id: "3", filename: "movie.mp4", uri: "file://3", sizeBytes: 900 * 1024 * 1024, mediaType: "video" },
      { id: "4", filename: "thumbnail-cache.jpg", uri: "file://4", sizeBytes: 12 * 1024 * 1024, mediaType: "photo" },
    ], 500);
    expect(candidates.map((item) => item.category)).toEqual(["duplicates", "duplicates", "large", "temporary"]);
    expect(candidates[0].selected).toBe(false);
    expect(candidates[1].selected).toBe(true);
    expect(candidates[3].selected).toBe(true);
  });

  it("selects native deletion only on supported native platforms", () => {
    expect(chooseDeletionMode("web", true)).toBe("fallback");
    expect(chooseDeletionMode("ios", true)).toBe("native");
    expect(chooseDeletionMode("android", false)).toBe("fallback");
  });

  it("identifies retryable cleanup states and messages them clearly", () => {
    expect(canRetryCleanup("permission-denied")).toBe(true);
    expect(canRetryCleanup("partial")).toBe(true);
    expect(canRetryCleanup("deleted")).toBe(false);
    expect(canStartCleanup(false)).toBe(true);
    expect(canStartCleanup(true)).toBe(false);
    expect(canStartUndoRestore(true, 1, 1_000, 2_000)).toBe(true);
    expect(canStartUndoRestore(false, 1, 1_000, 2_000)).toBe(false);
    expect(canStartUndoRestore(true, 0, 1_000, 2_000)).toBe(false);
    expect(canStartUndoRestore(true, 1, 2_000, 2_000)).toBe(false);
    expect(permissionRecoveryMessage("failed")).toContain("try cleanup again");
    expect(permissionRecoveryMessage("deleted")).toBe("Cleanup is complete.");
  });

  it("aggregates deletion results without exceeding the requested count", () => {
    expect(aggregateDeletionResult(3, 3, "native")).toMatchObject({ status: "deleted", deleted: 3 });
    expect(aggregateDeletionResult(3, 1, "native")).toMatchObject({ status: "partial", deleted: 1 });
    expect(aggregateDeletionResult(3, 10, "native")).toMatchObject({ status: "deleted", deleted: 3 });
    expect(aggregateDeletionResult(3, 0, "native")).toMatchObject({ status: "failed", deleted: 0 });
  });

  it("keeps empty native media input empty", () => {
    expect(mapNativeMediaToCandidates([])).toEqual([]);
  });

  it("keeps monetization states transparent and store-bound", () => {
    expect(getPlanDetails("yearly")).toMatchObject({ price: "$19.99", cadence: "per year" });
    expect(getSavingsLabel("yearly")).toBe("Save 44%");
    expect(getSavingsLabel("monthly")).toBe("");
    expect(getPurchaseButtonLabel("purchasing", "yearly")).toContain("secure checkout");
    expect(getPurchaseMessage("unavailable")).toContain("No payment was made");
    expect(getPurchaseResult().state).toBe("unavailable");
    expect(getRestoreResult().message).toContain("not charged");
    expect(canStartPurchase("idle")).toBe(true);
    expect(canStartPurchase("purchasing")).toBe(false);
    expect(canRestorePurchase("purchasing")).toBe(false);
    expect(canRestorePurchase("unavailable")).toBe(true);
    expect(getManageSubscriptionMessage()).toContain("App Store or Google Play");
    expect(isValidEntitlement({ isPro: true, source: "verified-store" })).toBe(true);
    expect(isValidEntitlement({ isPro: true, source: "preview" })).toBe(true);
    expect(isValidEntitlement({ isPro: "yes", source: "verified-store" })).toBe(false);
    expect(isValidEntitlement({ isPro: true, source: "unknown" })).toBe(false);
    expect(isValidPromptState({ lastShownAt: null, dismissed: false })).toBe(true);
    expect(isValidPromptState({ lastShownAt: 1_700_000_000_000, dismissed: true })).toBe(true);
    expect(isValidPromptState({ lastShownAt: Number.NaN, dismissed: false })).toBe(false);
    expect(isValidPromptState({ lastShownAt: -1, dismissed: false })).toBe(false);
    expect(isValidPromptState({ lastShownAt: "later", dismissed: false })).toBe(false);
    expect(getPremiumPrompt("similar-scans")).toContain("similar-image");
    expect(getPremiumPrompt("smart-selection")).toContain("smarter");
    expect(isPremiumFeatureAvailable("similar-scans", false)).toBe(false);
    expect(isPremiumFeatureAvailable("similar-scans", true)).toBe(true);
    expect(isPremiumFeatureAvailable("smart-selection", false)).toBe(true);
    expect(canShowUpgradePrompt(null, false, 1000)).toBe(true);
    expect(canShowUpgradePrompt(1000, false, 1000 + 6 * 24 * 60 * 60 * 1000)).toBe(false);
    expect(canShowUpgradePrompt(1000, false, 1000 + 7 * 24 * 60 * 60 * 1000)).toBe(true);
    expect(canShowUpgradePrompt(null, true, 1000)).toBe(false);
    expect(getValueReminder()).toContain("remain free");
    expect(getComparisonRows()).toHaveLength(5);
    expect(getComparisonRows().find((row) => row.label === "Similar-image matching")).toMatchObject({ free: false, pro: true });
    expect(getComparisonRows().find((row) => row.label === "Live web tips refresh")).toMatchObject({ free: false, pro: true });
    expect(getUpgradeIntentMessage("idle")).toContain("No charge");
    expect(getUpgradeIntentMessage("confirming")).toContain("Review your plan");
    expect(getUpgradeIntentMessage("ready")).toContain("secure platform checkout");
  });

  it("formats live category details from current summaries", () => {
    expect(formatCategoryDetail({ category: "duplicates", itemCount: 2, reclaimableBytes: 36.8, selectedBytes: 18.4 })).toBe("2 items · 36.8 MB to review");
    expect(formatCategoryDetail({ category: "large", itemCount: 1, reclaimableBytes: 2048, selectedBytes: 0 })).toBe("1 item · 2.0 GB to review");
  });

  it("creates clear category review hints for accessibility", () => {
    expect(formatCategoryReviewHint("Duplicates")).toBe("Opens duplicates cleanup results for review");
    expect(formatCategoryReviewHint("  Large Files ")).toBe("Opens large files cleanup results for review");
    expect(formatCategoryReviewHint("   ")).toBe("Opens cleanup results for review");
  });

  it("merges rapid theme preference updates without losing the other preference", () => {
    const initial = { colorScheme: "light" as const, reducedMotion: false };
    const dark = mergeThemePreferences(initial, { colorScheme: "dark" });
    expect(mergeThemePreferences(dark, { reducedMotion: true })).toEqual({ colorScheme: "dark", reducedMotion: true });
    expect(mergeThemePreferences(dark, {})).toEqual({ colorScheme: "dark", reducedMotion: false });
  });

  it("resolves malformed theme preferences to safe defaults", () => {
    expect(resolveThemePreferences({ colorScheme: "invalid" as never, reducedMotion: "yes" as never }, "dark")).toEqual({ colorScheme: "dark", reducedMotion: false });
    expect(resolveThemePreferences({ colorScheme: "light", reducedMotion: true }, "dark")).toEqual({ colorScheme: "light", reducedMotion: true });
  });

  it("serializes preference writes in order and recovers after a rejection", async () => {
    const writes: string[] = [];
    const write = async (value: string) => {
      writes.push(value);
      if (value === "first") throw new Error("storage unavailable");
    };
    let queue = Promise.resolve();
    queue = enqueuePreferenceWrite(queue, "first", write);
    queue = enqueuePreferenceWrite(queue, "second", write);
    await queue;
    expect(writes).toEqual(["first", "second"]);
  });

  it("serializes Premium-style entitlement and prompt writes through one recovery-safe queue", async () => {
    const writes: string[] = [];
    const write = async (value: string) => {
      writes.push(value);
      if (value === "entitlement") throw new Error("temporary storage failure");
    };
    let queue = Promise.resolve();
    queue = enqueuePreferenceWrite(queue, "entitlement", write);
    queue = enqueuePreferenceWrite(queue, "prompt", write);
    await queue;
    expect(writes).toEqual(["entitlement", "prompt"]);
  });

  it("recognizes the persistence retry timeout boundary without tracking file data", () => {
    const startedAt = 1_000;
    expect(hasPersistenceRetryTimedOut(startedAt, startedAt + PERSISTENCE_RETRY_TIMEOUT_MS - 1)).toBe(false);
    expect(hasPersistenceRetryTimedOut(startedAt, startedAt + PERSISTENCE_RETRY_TIMEOUT_MS)).toBe(true);
    expect(hasPersistenceRetryTimedOut(Number.NaN, startedAt + PERSISTENCE_RETRY_TIMEOUT_MS)).toBe(false);
    expect(getPersistenceRetryTimeoutMessage()).toContain("Your files were not affected");
  });

  it("only allows the newest local persistence write to update status", () => {
    expect(isLatestPersistenceWrite(4, 4)).toBe(true);
    expect(isLatestPersistenceWrite(3, 4)).toBe(false);
    expect(isLatestPersistenceWrite(4.5, 4)).toBe(false);
    expect(isLatestPersistenceWrite(Number.NaN, 4)).toBe(false);
  });

  it("keeps Diagnostics retry-state copy explicit and privacy-safe", () => {
    expect(getPersistenceRetryActionCopy(false)).toEqual({
      label: "Retry local save",
      hint: "Attempts to save your local preferences again without changing device files",
      buttonText: "Retry local save",
      icon: "refresh",
    });
    expect(getPersistenceRetryActionCopy(true)).toEqual({
      label: "Saving local preferences",
      hint: "Wait while local preferences are saved",
      buttonText: "Saving locally…",
      icon: "hourglass-top",
    });
    expect(getPersistenceRetryActionCopy(false, true)).toEqual({
      label: "Retry timed-out local save",
      hint: "The previous local save timed out. Attempts the save again without changing device files",
      buttonText: "Retry timed-out save",
      icon: "refresh",
    });
  });

  it("keeps Diagnostics persistence status wording aligned with recovery state", () => {
    expect(getPersistenceStatusValue(null, false)).toBe("Available");
    expect(getPersistenceStatusValue("Changes could not be saved locally.", false)).toBe("Using safe local fallback");
    expect(getPersistenceStatusValue("Local save timed out. Your files were not affected. Try again.", false)).toBe("Save timed out — retry available");
    expect(getPersistenceStatusValue("Changes could not be saved locally.", true)).toBe("Saving locally");
    expect(getPersistenceStatusTone(null, false)).toBe("default");
    expect(getPersistenceStatusTone("Changes could not be saved locally.", false)).toBe("warning");
    expect(getPersistenceStatusTone("Local save timed out. Your files were not affected. Try again.", false)).toBe("timeout");
    expect(getPersistenceStatusTone(null, true)).toBe("warning");
    expect(getPersistenceStatusIcon(null, false)).toBe("check-circle-outline");
    expect(getPersistenceStatusIcon("Changes could not be saved locally.", false)).toBe("warning-amber");
    expect(getPersistenceStatusIcon("Local save timed out. Your files were not affected. Try again.", false)).toBe("timer-off");
    expect(getPersistenceStatusIcon(null, true)).toBe("hourglass-top");
  });

  it("normalizes storage capacity and formats device values safely", () => {
    expect(normalizeStorageInfo(1000, 250)).toEqual({ totalBytes: 1000, freeBytes: 250, usedBytes: 750, percentUsed: 75 });
    expect(normalizeStorageInfo(1000, 1400)).toEqual({ totalBytes: 1000, freeBytes: 1000, usedBytes: 0, percentUsed: 0 });
    expect(normalizeStorageInfo(0, 0)).toBeNull();
    expect(formatBytes(1024 ** 3)).toBe("1.0 GB");
    expect(formatBytes(-1)).toBe("Unavailable");
    expect(canApplyStorageRefresh(2, 2, true)).toBe(true);
    expect(canApplyStorageRefresh(1, 2, true)).toBe(false);
    expect(canApplyStorageRefresh(2.5, 2, true)).toBe(false);
    expect(canApplyStorageRefresh(2, 2, false)).toBe(false);
    expect(getGuidePersistenceFailureMessage()).toBe("The cleanup guide preference could not be saved locally. Your files were not affected.");
    expect(getGuidePersistenceFailureMessage()).not.toMatch(/\/|\\|\.jpg|\.mp4/i);
  });
});
