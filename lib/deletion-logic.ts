export type DeletionMode = "native" | "fallback";
export type DeletionStatus = "deleted" | "partial" | "permission-denied" | "unsupported" | "failed";
export type DeletionResult = { mode: DeletionMode; status: DeletionStatus; requested: number; deleted: number };

export function chooseDeletionMode(platform: string, nativeAvailable: boolean): DeletionMode {
  return platform !== "web" && nativeAvailable ? "native" : "fallback";
}

export function canStartCleanup(isInFlight: boolean): boolean {
  return !isInFlight;
}

export function getCleanupProgressAccessibilityLabel(isCleaning: boolean): string {
  return isCleaning ? "Cleanup in progress. Selected items are being processed safely. Please wait." : "Cleanup is ready for confirmation.";
}

export function canRestoreUndo(now: number, expiresAt: number | null): boolean {
  return Number.isFinite(now) && expiresAt !== null && Number.isFinite(expiresAt) && expiresAt > now;
}

export function canStartUndoRestore(mounted: boolean, itemCount: number, now: number, expiresAt: number | null): boolean {
  return mounted && itemCount > 0 && canRestoreUndo(now, expiresAt);
}

export function canApplyUndoExpiryCallback(mounted: boolean): boolean {
  return mounted;
}

export function getUndoCountdownAccessibilityLabel(seconds: number): string {
  const safeSeconds = Math.max(0, Math.min(30, Math.ceil(Number.isFinite(seconds) ? seconds : 0)));
  if (safeSeconds === 0) return "Undo window has expired.";
  return `Undo available for ${safeSeconds} ${safeSeconds === 1 ? "second" : "seconds"}.`;
}

export function isCleanupBlocked(status: DeletionStatus | null | undefined): boolean {
  return status === "permission-denied" || status === "failed" || status === "partial";
}

export function isCleanupPreview(status: DeletionStatus | null | undefined): boolean {
  return status === "unsupported";
}

export function getCleanupCompletionCopy(status: DeletionStatus | null | undefined, itemCount: number): { title: string; subtitle: string } {
  if (isCleanupBlocked(status)) {
    return {
      title: "Cleanup needs attention.",
      subtitle: "We could not remove the selected native media. Your files were left unchanged; review permissions and try again.",
    };
  }
  if (isCleanupPreview(status)) {
    return {
      title: "Preview only — nothing was deleted.",
      subtitle: "This environment cannot remove files. Selected items were taken off the review list so you can try the flow. Run cleanup on a phone to delete for real.",
    };
  }
  if (itemCount > 0) {
    return {
      title: "Your device feels lighter.",
      subtitle: "Cleanup is complete. We removed only the items you selected and kept everything else untouched.",
    };
  }
  return {
    title: "Nothing was removed.",
    subtitle: "No items were selected for cleanup. Your storage was left unchanged.",
  };
}

export function getCleanupCompletionAccessibilityLabel(status: DeletionStatus | null | undefined, itemCount: number, reclaimedLabel: string): string {
  if (status === "partial") return `Cleanup partially completed. ${itemCount} selected ${itemCount === 1 ? "item remains" : "items remain"} unchanged.`;
  if (isCleanupPreview(status)) return "Preview cleanup only. Files were not deleted on this device.";
  if (status === "permission-denied" || status === "failed") return "Cleanup needs attention. Your files were left unchanged.";
  if (itemCount > 0) return `Cleanup complete. ${reclaimedLabel} reclaimed from ${itemCount} selected ${itemCount === 1 ? "item" : "items"}.`;
  return "Cleanup finished. No files were changed.";
}

export function canRetryCleanup(status: DeletionStatus) {
  return status === "permission-denied" || status === "failed" || status === "partial";
}

export function permissionRecoveryMessage(status: DeletionStatus) {
  return canRetryCleanup(status) ? "Review permissions and try cleanup again." : "Cleanup is complete.";
}

export function aggregateDeletionResult(requested: number, deleted: number, mode: DeletionMode): DeletionResult {
  const safeDeleted = Math.max(0, Math.min(requested, deleted));
  return { mode, status: safeDeleted === requested ? "deleted" : safeDeleted > 0 ? "partial" : "failed", requested, deleted: safeDeleted };
}
