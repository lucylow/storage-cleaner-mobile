export const PERSISTENCE_RETRY_TIMEOUT_MS = 10_000;

export function hasPersistenceRetryTimedOut(startedAt: number, now: number): boolean {
  return Number.isFinite(startedAt) && Number.isFinite(now) && now - startedAt >= PERSISTENCE_RETRY_TIMEOUT_MS;
}

export function getPersistenceRetryTimeoutMessage(): string {
  return "Local save timed out. Your files were not affected. Try again.";
}

export function getHydrationFailureMessage(): string {
  return "Saved local state was invalid. Safe defaults are in use; your files were not affected.";
}

export function shouldClearPersistenceWarningAfterWrite(hydrationWarningPending: boolean): boolean {
  return !hydrationWarningPending;
}

export function canApplyPersistenceRetryCallback(mounted: boolean): boolean {
  return mounted;
}

/** Only the newest queued write may update persistence status UI. */
export function isLatestPersistenceWrite(resultGeneration: number, latestGeneration: number): boolean {
  return Number.isInteger(resultGeneration) && Number.isInteger(latestGeneration) && resultGeneration === latestGeneration;
}

export function getPersistenceStatusIcon(warning: string | null, retrying: boolean): "check-circle-outline" | "warning-amber" | "timer-off" | "hourglass-top" {
  if (retrying) return "hourglass-top";
  if (warning?.startsWith("Local save timed out")) return "timer-off";
  if (warning) return "warning-amber";
  return "check-circle-outline";
}

export function getPersistenceStatusTone(warning: string | null, retrying: boolean): "default" | "warning" | "timeout" {
  if (warning?.startsWith("Local save timed out")) return "timeout";
  if (retrying || warning) return "warning";
  return "default";
}

export function getPersistenceStatusValue(warning: string | null, retrying: boolean): string {
  if (retrying) return "Saving locally";
  if (warning?.startsWith("Local save timed out")) return "Save timed out — retry available";
  if (warning) return "Using safe local fallback";
  return "Available";
}

export function getPersistenceRetryActionCopy(retrying: boolean, timedOut = false): {
  label: string;
  hint: string;
  buttonText: string;
  icon: "hourglass-top" | "refresh";
} {
  if (timedOut && !retrying) {
    return {
      label: "Retry timed-out local save",
      hint: "The previous local save timed out. Attempts the save again without changing device files",
      buttonText: "Retry timed-out save",
      icon: "refresh",
    };
  }

  return retrying
    ? {
        label: "Saving local preferences",
        hint: "Wait while local preferences are saved",
        buttonText: "Saving locally…",
        icon: "hourglass-top",
      }
    : {
        label: "Retry local save",
        hint: "Attempts to save your local preferences again without changing device files",
        buttonText: "Retry local save",
        icon: "refresh",
      };
}
