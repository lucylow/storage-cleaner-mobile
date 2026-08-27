import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import { appendScanHistory, calculateSelectedBytes, canUndoCleanup, createCleanupSummary, getSelectedCleanupItems, removeSelectedItems, restoreCleanupItems, sanitizeCleanupHistory, sanitizeCleanupItems, sanitizeCleanupSummary, sanitizeScanHistory, setCategorySelection, setItemProtected, toggleCleanupItem } from "./cleaner-logic";
import { getMediaPermissionReadiness, openMediaPermissionSettings, scanDevice, type ScannerMode } from "./scanner-service";
import { canApplyPermissionRefresh, canApplyScanCallback, getPermissionAppActiveAnnouncement, getPermissionRecoveryAnnouncement, getScanSessionState, getNextScanTimeout, sanitizePersistedScanDiagnostic, sanitizePersistedScanLabel, sanitizeScanDiagnosticCounters, SCAN_SESSION_TIMEOUT_MS, shouldExpireScanSession, shouldRefreshPermissionOnAppState, type PermissionReadiness, type ScanDiagnostic, type ScanDiagnosticCounters, type ScanSessionState } from "./scanner-logic";
import { deleteNativeMedia, recoverMediaPermission, type DeletionResult, type PermissionRecovery } from "./deletion-service";
import { canApplyUndoExpiryCallback, canRestoreUndo, canStartCleanup, canStartUndoRestore } from "./deletion-logic";
import { getDiagnosticHydrationRecoveryMessage, hydrateDiagnosticCounters } from "./diagnostic-logic";
import { canApplyPersistenceRetryCallback, getHydrationFailureMessage, getPersistenceRetryTimeoutMessage, isLatestPersistenceWrite, shouldClearPersistenceWarningAfterWrite, PERSISTENCE_RETRY_TIMEOUT_MS } from "./persistence-logic";
import { applyLowRiskSelection, getAIActionPolicy, runAIAnalysis, type AIAnalysisResult, type AIRecommendation, type WebInsight, type WebInsightErrorCode } from "./ai";
import { toWebSafeScanItems } from "./ai/privacy-filter";
import { logger } from "./privacy-safe-logger";
import { isWebIntelligenceFlagEnabled } from "./integrations/serpapi/serpapi-config";
import { clearCachedSearches } from "./integrations/serpapi/serpapi-cache";
import { searchPublicWebKnowledge, searchStorageWebInsight } from "./integrations/serpapi/serpapi-service";
import { attachWebInsight, emptyWebInsight, isUsableSearchPayload, sanitizePersistedWebInsight, searchResultToWebInsight } from "./integrations/serpapi/web-insight-fusion";
import { buildStorageQueryContext } from "./integrations/serpapi/query-builder";
import { searchLocaleFromAppLocale } from "./integrations/serpapi/search-locale";
import { isAllowedWebIntelligenceQuery } from "../shared/web-intelligence-allowlist";
import { XanoApiError } from "./integrations/xano/xano-types";
import {
  WEB_INTELLIGENCE_QUOTA_KEY,
  canConsumeDailySearch,
  canRefreshWebInsight as canRefreshWebInsightQuota,
  getDailySearchLimit,
  nextQuotaState,
  normalizeQuotaState,
  quotaStateFromRemaining,
  utcDayKey,
  type WebIntelligenceQuotaState,
} from "./integrations/serpapi/web-intelligence-quota";
import { ENTITLEMENT_KEY, isValidEntitlement } from "./premium-store";

export type CleanupCategory = "duplicates" | "large" | "temporary";

export type CleanupItem = {
  id: string;
  name: string;
  location: string;
  size: number;
  category: CleanupCategory;
  selected: boolean;
  protected?: boolean;
};

const STORAGE_KEY = "storage-cleaner-state-v1";

function createAnonymousDeviceId() {
  return `dev${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeAnonymousDeviceId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : createAnonymousDeviceId();
}

function resolveDevicePlatform(): "ios" | "android" | "web" {
  return Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web";
}

async function readVerifiedPro() {
  try {
    const raw = await AsyncStorage.getItem(ENTITLEMENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return isValidEntitlement(parsed) && parsed.isPro;
  } catch {
    return false;
  }
}
const seedItems: CleanupItem[] = [
  { id: "dup-1", name: "IMG_4821.JPG", location: "Photos · Duplicate group", size: 18.4, category: "duplicates", selected: false, protected: false },
  { id: "dup-2", name: "IMG_4821 copy.JPG", location: "Photos · Duplicate group", size: 18.4, category: "duplicates", selected: true, protected: false },
  { id: "large-1", name: "Travel documentary.mp4", location: "Videos · Larger than 1 GB", size: 842, category: "large", selected: false, protected: false },
  { id: "large-2", name: "Offline playlist cache", location: "Music · Downloaded media", size: 384, category: "large", selected: false, protected: false },
  { id: "temp-1", name: "Temporary thumbnails", location: "System · Safe to remove", size: 126, category: "temporary", selected: true, protected: false },
];

export type CleanupSummary = { reclaimedBytes: number; itemCount: number };
export type ScanHistoryEntry = { id: string; scannedAt: number; reclaimableBytes: number; itemCount: number };
export type CleanupHistoryEntry = { id: string; completedAt: number; reclaimedBytes: number; itemCount: number; status: "completed" | "partial" | "failed"; undoAvailable: boolean };
type PersistedState = { items: CleanupItem[]; lastScanLabel: string; lastCleanupSummary: CleanupSummary | null; lastScanDiagnostic?: ScanDiagnostic | null; scanHistory: ScanHistoryEntry[]; cleanupHistory?: CleanupHistoryEntry[]; largeFileThreshold?: number; scanTimeoutMs?: number; scanDiagnosticCounters?: ScanDiagnosticCounters; webIntelligenceEnabled?: boolean; anonymousDeviceId?: string; lastWebInsight?: WebInsight | null };
type CleanerContextValue = {
  items: CleanupItem[];
  isHydrated: boolean;
  isScanning: boolean;
  isScanPaused: boolean;
  scanSessionState: ScanSessionState;
  scanTimeoutMs: number;
  scanDiagnosticCounters: ScanDiagnosticCounters;
  persistenceWarning: string | null;
  retryPersistence: () => void;
  persistenceRetrying: boolean;
  cycleScanTimeout: () => void;
  pauseScan: () => void;
  resumeScan: () => void;
  scanProgress: number;
  scannerMode: ScannerMode;
  discoveredItemCount: number;
  scanCategory: string;
  lastScanLabel: string;
  lastCleanupSummary: CleanupSummary | null;
  lastScanDiagnostic: ScanDiagnostic | null;
  permissionReadiness: PermissionReadiness;
  permissionAnnouncement: string | null;
  refreshPermissionReadiness: () => Promise<void>;
  openPermissionSettings: () => Promise<import("./scanner-logic").PermissionRecoveryIntent>;
  lastDeletionResult: DeletionResult | null;
  recoverPermission: () => Promise<PermissionRecovery>;
  scanHistory: ScanHistoryEntry[];
  cleanupHistory: CleanupHistoryEntry[];
  selectedBytes: number;
  protectedCount: number;
  largeFileThreshold: number;
  setLargeFileThreshold: (value: number) => void;
  startScan: () => void;
  cancelScan: () => void;
  retryScan: () => void;
  toggleItem: (id: string) => void;
  toggleProtected: (id: string) => void;
  selectCategory: (category: CleanupCategory, selected?: boolean) => void;
  completeCleanup: () => void;
  clearHistory: () => void;
  clearCleanupHistory: () => void;
  canUndoCleanup: boolean;
  undoExpiresAt: number | null;
  undoCleanup: () => void;
  aiAnalysis: AIAnalysisResult | null;
  isAnalyzingAI: boolean;
  applySmartSelection: () => void;
  smartSelectedBytes: number;
  getRecommendationByItemId: (itemId: string) => AIRecommendation | null;
  webIntelligenceEnabled: boolean;
  webIntelligenceAvailable: boolean;
  setWebIntelligenceEnabled: (value: boolean) => void;
  refreshWebInsight: () => Promise<void>;
  retryWebInsight: () => Promise<void>;
  askRelatedWebQuestion: (question: string) => Promise<void>;
  canRefreshWebInsight: boolean;
  canRetryWebInsight: boolean;
  webInsightQuotaRemaining: number;
  webInsight: WebInsight | null;
};

const CleanerContext = createContext<CleanerContextValue | null>(null);

function errorCodeFromUnknown(error: unknown): WebInsightErrorCode {
  if (error instanceof XanoApiError) {
    if (error.detailCode === "quota" || error.code === "RATE_LIMITED") return "quota";
    if (error.detailCode === "blocked") return "blocked";
    if (error.detailCode === "unavailable" || error.status === 503 || error.code === "SERVER") return "unavailable";
    if (error.status === 400 || error.code === "FORBIDDEN") return "blocked";
    if (error.detailCode === "network" || error.code === "TIMEOUT" || error.code === "NETWORK") return "network";
  }
  return "network";
}

function currentAppLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return "en";
  }
}

const SEARCH_LOCALE_PREFERENCE_KEY = "clearspace.locale-preference.v1";

async function resolveSearchLocale() {
  try {
    const preference = await AsyncStorage.getItem(SEARCH_LOCALE_PREFERENCE_KEY);
    if (preference && preference !== "system") {
      return searchLocaleFromAppLocale(preference);
    }
  } catch {
    /* use device locale */
  }
  return searchLocaleFromAppLocale(currentAppLocale());
}

export function CleanerProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CleanupItem[]>(seedItems);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isScanPaused, setIsScanPaused] = useState(false);
  const [scanSessionState, setScanSessionState] = useState<ScanSessionState>("idle");
  const [scanTimeoutMs, setScanTimeoutMs] = useState<number>(SCAN_SESSION_TIMEOUT_MS);
  const [scanDiagnosticCounters, setScanDiagnosticCounters] = useState<ScanDiagnosticCounters>({ timeoutCount: 0, cancellationCount: 0 });
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const [persistenceRetryToken, setPersistenceRetryToken] = useState(0);
  const [persistenceRetrying, setPersistenceRetrying] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scannerMode, setScannerMode] = useState<ScannerMode>("fallback");
  const [discoveredItemCount, setDiscoveredItemCount] = useState(0);
  const [scanCategory, setScanCategory] = useState("Ready to scan");
  const [lastScanLabel, setLastScanLabel] = useState("Never scanned");
  const [lastScanDiagnostic, setLastScanDiagnostic] = useState<ScanDiagnostic | null>(null);
  const [permissionReadiness, setPermissionReadiness] = useState<PermissionReadiness>("unsupported");
  const [permissionAnnouncement, setPermissionAnnouncement] = useState<string | null>(null);
  const [lastCleanupSummary, setLastCleanupSummary] = useState<CleanupSummary | null>(null);
  const [lastDeletionResult, setLastDeletionResult] = useState<DeletionResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [cleanupHistory, setCleanupHistory] = useState<CleanupHistoryEntry[]>([]);
  const [largeFileThreshold, setLargeFileThreshold] = useState(500);
  const [undoItems, setUndoItems] = useState<CleanupItem[] | null>(null);
  const [undoExpiresAt, setUndoExpiresAt] = useState<number | null>(null);
  const [aiAnalysis, setAIAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [webIntelligenceEnabled, setWebIntelligenceEnabledState] = useState(false);
  const [anonymousDeviceId, setAnonymousDeviceId] = useState(createAnonymousDeviceId);
  const [webQuota, setWebQuota] = useState<WebIntelligenceQuotaState>({ day: utcDayKey(), count: 0 });
  const [isProEntitled, setIsProEntitled] = useState(false);
  const [persistedWebInsight, setPersistedWebInsight] = useState<WebInsight | null>(null);
  const webFetchGeneration = useRef(0);
  const scanTimer = useRef<AbortController | null>(null);
  const pauseRequested = useRef(false);
  const pauseResolver = useRef<(() => void) | null>(null);
  const backgroundedAt = useRef<number | null>(null);
  const sessionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistenceRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistenceWriteChain = useRef(Promise.resolve());
  const persistenceWriteGeneration = useRef(0);
  const hydrationWarningPending = useRef(false);
  const cleanupInFlight = useRef(false);
  const mountedRef = useRef(true);
  const permissionRequestRef = useRef(0);
  const webConversationTokenRef = useRef<string | undefined>(undefined);
  const webConversationTurnsRef = useRef(0);

  useEffect(() => {
    let active = true;
    void getMediaPermissionReadiness().then((readiness) => { if (active) setPermissionReadiness(readiness); }).catch(() => { if (active) setPermissionReadiness("unsupported"); });
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (!active) return;
      if (value) {
        try {
          const parsed = JSON.parse(value) as PersistedState;
          const hydratedItems = sanitizeCleanupItems(parsed.items);
          if (hydratedItems.length) setItems(hydratedItems);
          setLastScanLabel(sanitizePersistedScanLabel(parsed.lastScanLabel));
          const hydratedScanDiagnostic = sanitizePersistedScanDiagnostic(parsed.lastScanDiagnostic);
          if (hydratedScanDiagnostic) setLastScanDiagnostic(hydratedScanDiagnostic);
          const hydratedCleanupSummary = sanitizeCleanupSummary(parsed.lastCleanupSummary);
          if (hydratedCleanupSummary) setLastCleanupSummary(hydratedCleanupSummary);
          setScanHistory(sanitizeScanHistory(parsed.scanHistory));
          setCleanupHistory(sanitizeCleanupHistory(parsed.cleanupHistory));
          if (typeof parsed.largeFileThreshold === "number" && Number.isFinite(parsed.largeFileThreshold) && parsed.largeFileThreshold >= 250 && parsed.largeFileThreshold <= 5000) setLargeFileThreshold(parsed.largeFileThreshold);
          if (parsed.scanTimeoutMs === 60_000 || parsed.scanTimeoutMs === 120_000 || parsed.scanTimeoutMs === 300_000) setScanTimeoutMs(parsed.scanTimeoutMs);
          const hydratedDiagnosticCounters = hydrateDiagnosticCounters(parsed.scanDiagnosticCounters);
          setScanDiagnosticCounters(hydratedDiagnosticCounters);
          setWebIntelligenceEnabledState(parsed.webIntelligenceEnabled === true);
          setAnonymousDeviceId(sanitizeAnonymousDeviceId(parsed.anonymousDeviceId));
          const hydratedWebInsight = sanitizePersistedWebInsight(parsed.lastWebInsight);
          if (hydratedWebInsight) setPersistedWebInsight(hydratedWebInsight);
          if (hydratedDiagnosticCounters.recovered) {
            hydrationWarningPending.current = true;
            setPersistenceWarning(getDiagnosticHydrationRecoveryMessage());
          }
        } catch {
          hydrationWarningPending.current = true;
          setPersistenceWarning(getHydrationFailureMessage());
        }
      }
      setIsHydrated(true);
    }).catch(() => { if (active) { hydrationWarningPending.current = true; setPersistenceWarning("Local preferences could not be loaded. Safe defaults are in use."); setIsHydrated(true); } });
    void AsyncStorage.getItem(WEB_INTELLIGENCE_QUOTA_KEY).then((value) => {
      if (!active) return;
      try {
        setWebQuota(normalizeQuotaState(value ? JSON.parse(value) : null));
      } catch {
        setWebQuota({ day: utcDayKey(), count: 0 });
      }
    }).catch(() => undefined);
    void readVerifiedPro().then((isPro) => { if (active) setIsProEntitled(isPro); });
    return () => { active = false; };
  }, []);

  const retryPersistence = () => {
    if (persistenceRetrying) return;
    if (persistenceRetryTimer.current) clearTimeout(persistenceRetryTimer.current);
    setPersistenceWarning(null);
    setPersistenceRetrying(true);
    persistenceRetryTimer.current = setTimeout(() => {
      persistenceRetryTimer.current = null;
      if (!canApplyPersistenceRetryCallback(mountedRef.current)) return;
      setPersistenceRetrying(false);
      setPersistenceWarning(getPersistenceRetryTimeoutMessage());
    }, PERSISTENCE_RETRY_TIMEOUT_MS);
    setPersistenceRetryToken((value) => value + 1);
  };

  useEffect(() => {
    if (!isHydrated) return;
    let active = true;
    const persistedState = { items, lastScanLabel, lastScanDiagnostic, lastCleanupSummary, scanHistory, cleanupHistory, largeFileThreshold, scanTimeoutMs, scanDiagnosticCounters, webIntelligenceEnabled, anonymousDeviceId, lastWebInsight: persistedWebInsight } satisfies PersistedState;
    let serializedState: string;
    try {
      serializedState = JSON.stringify(persistedState);
    } catch {
      if (persistenceRetryTimer.current) {
        clearTimeout(persistenceRetryTimer.current);
        persistenceRetryTimer.current = null;
      }
      if (active) {
        setPersistenceRetrying(false);
        setPersistenceWarning("Changes could not be prepared for local storage. Your files were not affected.");
      }
      return () => {
        active = false;
      };
    }
    const writeGeneration = persistenceWriteGeneration.current + 1;
    persistenceWriteGeneration.current = writeGeneration;
    persistenceWriteChain.current = persistenceWriteChain.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(STORAGE_KEY, serializedState))
      .then(() => {
        if (!isLatestPersistenceWrite(writeGeneration, persistenceWriteGeneration.current)) return;
        if (persistenceRetryTimer.current) {
          clearTimeout(persistenceRetryTimer.current);
          persistenceRetryTimer.current = null;
        }
        if (active) {
          if (shouldClearPersistenceWarningAfterWrite(!hydrationWarningPending.current)) setPersistenceWarning(null);
          hydrationWarningPending.current = false;
          setPersistenceRetrying(false);
        }
      })
      .catch(() => {
        if (!isLatestPersistenceWrite(writeGeneration, persistenceWriteGeneration.current)) return;
        if (persistenceRetryTimer.current) {
          clearTimeout(persistenceRetryTimer.current);
          persistenceRetryTimer.current = null;
        }
        if (active) {
          setPersistenceWarning("Changes could not be saved locally. Your files were not affected.");
          setPersistenceRetrying(false);
        }
      });
    return () => {
      active = false;
    };
  }, [items, lastScanLabel, lastScanDiagnostic, lastCleanupSummary, scanHistory, cleanupHistory, largeFileThreshold, scanTimeoutMs, scanDiagnosticCounters, webIntelligenceEnabled, anonymousDeviceId, persistedWebInsight, isHydrated, persistenceRetryToken]);

  useEffect(() => () => {
    mountedRef.current = false;
    scanTimer.current?.abort();
    pauseResolver.current?.();
    if (sessionTimeout.current) clearTimeout(sessionTimeout.current);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    if (persistenceRetryTimer.current) clearTimeout(persistenceRetryTimer.current);
  }, []);

  useEffect(() => {
    let active = true;
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (isScanning && nextState !== "active" && !pauseRequested.current) {
        backgroundedAt.current = Date.now();
        if (sessionTimeout.current) clearTimeout(sessionTimeout.current);
        sessionTimeout.current = setTimeout(() => {
          if (!canApplyScanCallback(mountedRef.current, false)) return;
          if (!shouldExpireScanSession(backgroundedAt.current, Date.now(), scanTimeoutMs)) return;
          pauseResolver.current?.();
          scanTimer.current?.abort();
          scanTimer.current = null;
          pauseRequested.current = false;
          backgroundedAt.current = null;
          setIsScanning(false);
          setIsScanPaused(false);
          setScanSessionState("idle");
          setScanProgress(0);
          setScanCategory("Scan session expired safely");
          setScanDiagnosticCounters((current) => ({ ...current, timeoutCount: current.timeoutCount + 1 }));
        }, scanTimeoutMs);
        pauseRequested.current = true;
        setIsScanPaused(true);
        setScanSessionState("backgrounded");
        setScanCategory("Paused while app is in the background");
      }
      if (nextState === "active" && backgroundedAt.current !== null) {
        if (sessionTimeout.current) clearTimeout(sessionTimeout.current);
        sessionTimeout.current = null;
      }
      if (shouldRefreshPermissionOnAppState(previousState, nextState)) {
        const requestId = permissionRequestRef.current + 1;
        permissionRequestRef.current = requestId;
        void getMediaPermissionReadiness().then((readiness) => { if (canApplyPermissionRefresh(requestId, permissionRequestRef.current, mountedRef.current && active)) { setPermissionReadiness(readiness); setPermissionAnnouncement(getPermissionAppActiveAnnouncement(readiness)); } }).catch(() => { if (canApplyPermissionRefresh(requestId, permissionRequestRef.current, mountedRef.current && active)) { setPermissionReadiness("unsupported"); setPermissionAnnouncement(getPermissionAppActiveAnnouncement("unsupported")); } });
      }
      previousState = nextState;
    });
    return () => { active = false; subscription.remove(); };
  }, [isScanning, scanTimeoutMs]);

  const refreshPermissionReadiness = async () => {
    const requestId = permissionRequestRef.current + 1;
    permissionRequestRef.current = requestId;
    try {
      const readiness = await getMediaPermissionReadiness();
      if (canApplyPermissionRefresh(requestId, permissionRequestRef.current, mountedRef.current)) setPermissionReadiness(readiness);
    } catch {
      if (canApplyPermissionRefresh(requestId, permissionRequestRef.current, mountedRef.current)) setPermissionReadiness("unsupported");
    }
  };
  const openPermissionSettings = async () => openMediaPermissionSettings();

  const startScan = () => {
    scanTimer.current?.abort();
    pauseResolver.current?.();
    pauseResolver.current = null;
    pauseRequested.current = false;
    backgroundedAt.current = null;
    if (sessionTimeout.current) clearTimeout(sessionTimeout.current);
    sessionTimeout.current = null;
    setIsScanPaused(false);
    setScanSessionState("running");
    const controller = new AbortController();
    scanTimer.current = controller;
    setIsScanning(true);
    setScanProgress(0);
    setDiscoveredItemCount(0);
    setScanCategory("Preparing local scan");
    setLastScanDiagnostic(null);
    void scanDevice({ largeFileThreshold, signal: controller.signal, waitIfPaused: async () => { if (!pauseRequested.current) return; await new Promise<void>((resolve) => { pauseResolver.current = resolve; }); }, onProgress: ({ progress, category, discoveredItems }) => {
      if (!canApplyScanCallback(mountedRef.current, controller.signal.aborted)) return;
      setScanProgress(progress);
      setScanCategory(category);
      setDiscoveredItemCount(discoveredItems);
    }}).then((report) => {
      if (!report || !canApplyScanCallback(mountedRef.current, controller.signal.aborted)) return;
      setScannerMode(report.mode);
      setLastScanDiagnostic(report.diagnostic ?? null);
      setIsScanning(false);
      setIsScanPaused(false);
      setScanSessionState("idle");
      backgroundedAt.current = null;
      if (sessionTimeout.current) clearTimeout(sessionTimeout.current);
      sessionTimeout.current = null;
      pauseRequested.current = false;
      pauseResolver.current = null;
      setLastScanLabel("Just now");
      const nextItems = report.candidates ?? items;
      if (report.candidates) setItems(nextItems);
      const timestamp = Date.now();
      setScanHistory((history) => appendScanHistory(history, { id: `${timestamp}`, scannedAt: timestamp, reclaimableBytes: calculateSelectedBytes(nextItems), itemCount: nextItems.filter((item) => item.selected).length }));
      void analyzeWithAI(`${timestamp}`, nextItems);
      scanTimer.current = null;
    }).catch(() => {
      if (!canApplyScanCallback(mountedRef.current, controller.signal.aborted)) return;
      if (sessionTimeout.current) clearTimeout(sessionTimeout.current);
      sessionTimeout.current = null;
      pauseRequested.current = false;
      pauseResolver.current = null;
      backgroundedAt.current = null;
      setIsScanning(false);
      setIsScanPaused(false);
      setScanSessionState("idle");
      setScanProgress(0);
      setScanCategory("Scan needs attention");
      setLastScanDiagnostic({ code: "unknown", message: "The local scan could not finish. You can retry safely." });
      setAIAnalysis(null);
      setIsAnalyzingAI(false);
      scanTimer.current = null;
    });
  };

    const retryScan = () => startScan();
  const cycleScanTimeout = () => setScanTimeoutMs((current) => getNextScanTimeout(current));
  const pauseScan = () => {
    if (!isScanning || isScanPaused) return;
    pauseRequested.current = true;
    setIsScanPaused(true);
    setScanSessionState("paused");
  };
  const resumeScan = () => {
    if (!isScanning || !isScanPaused) return;
    pauseRequested.current = false;
    backgroundedAt.current = null;
    if (sessionTimeout.current) clearTimeout(sessionTimeout.current);
    sessionTimeout.current = null;
    setIsScanPaused(false);
    setScanSessionState("running");
    pauseResolver.current?.();
    pauseResolver.current = null;
  };

  const cancelScan = () => {
    if (!isScanning && !isScanPaused && !scanTimer.current) return;
    pauseRequested.current = false;
    backgroundedAt.current = null;
    if (sessionTimeout.current) clearTimeout(sessionTimeout.current);
    sessionTimeout.current = null;
    setIsScanPaused(false);
    setScanSessionState("idle");
    pauseResolver.current?.();
    pauseResolver.current = null;
    scanTimer.current?.abort();
    scanTimer.current = null;
    setIsScanning(false);
    setScanProgress(0);
    setScanCategory("Scan cancelled");
    setScanDiagnosticCounters((current) => ({ ...current, cancellationCount: current.cancellationCount + 1 }));
  };

  const toggleItem = (id: string) => setItems((current) => toggleCleanupItem(current, id));
  const toggleProtected = (id: string) => setItems((current) => { const item = current.find((candidate) => candidate.id === id); return setItemProtected(current, id, !item?.protected); });
  const selectCategory = (category: CleanupCategory, selected = true) => setItems((current) => setCategorySelection(current, category, selected));
  const clearHistory = () => setScanHistory([]);
  const clearCleanupHistory = () => setCleanupHistory([]);
  const updateLargeFileThreshold = (value: number) => setLargeFileThreshold(Math.max(250, Math.min(5000, Math.round(value))));

  const recoverPermission = async () => {
    const recovery = await recoverMediaPermission();
    if (mountedRef.current) setPermissionAnnouncement(getPermissionRecoveryAnnouncement(recovery));
    if (recovery === "granted" || recovery === "requested-denied") await refreshPermissionReadiness();
    return recovery;
  };

  const persistWebQuota = (next: WebIntelligenceQuotaState) => {
    setWebQuota(next);
    void AsyncStorage.setItem(WEB_INTELLIGENCE_QUOTA_KEY, JSON.stringify(next)).catch(() => undefined);
  };

  const applySearchPayload = (analysis: AIAnalysisResult, payload: Awaited<ReturnType<typeof searchPublicWebKnowledge>>) => {
    if (payload.disabled) return attachWebInsight(analysis, emptyWebInsight("disabled", payload.query, "blocked"));
    if (!isUsableSearchPayload(payload)) {
      return attachWebInsight(analysis, emptyWebInsight("error", payload.query, "empty"));
    }
    if (payload.subsequentRequestToken) {
      webConversationTokenRef.current = payload.subsequentRequestToken;
    } else {
      webConversationTokenRef.current = undefined;
    }
    const insight = searchResultToWebInsight(payload);
    insight.fromCache = payload.fromCache === true;
    setPersistedWebInsight(insight);
    return attachWebInsight(analysis, insight);
  };

  const fetchWebInsight = async (
    analysis: AIAnalysisResult,
    nextItems: CleanupItem[],
    question?: string,
    extras?: { noCache?: boolean },
  ) => {
    const isPro = await readVerifiedPro();
    if (mountedRef.current) setIsProEntitled(isPro);
    const quota = normalizeQuotaState(webQuota);
    if (!canConsumeDailySearch(quota.count, isPro)) {
      if (mountedRef.current) setAIAnalysis(attachWebInsight(analysis, emptyWebInsight("error", question ?? "", "quota")));
      return;
    }
    if (question && !isAllowedWebIntelligenceQuery(question)) {
      if (mountedRef.current) setAIAnalysis(attachWebInsight(analysis, emptyWebInsight("error", question, "blocked")));
      return;
    }
    const generation = ++webFetchGeneration.current;
    const currentReady = analysis.webInsight?.status === "ready" ? analysis.webInsight : persistedWebInsight;
    if (mountedRef.current) {
      setAIAnalysis(
        attachWebInsight(
          analysis,
          currentReady ? { ...currentReady, refreshing: true } : emptyWebInsight("loading", question ?? ""),
        ),
      );
    }
    try {
      const searchLocale = await resolveSearchLocale();
      const options = {
        language: searchLocale.language,
        country: searchLocale.country,
        device: "mobile" as const,
        deviceId: anonymousDeviceId,
        isPro,
        continuable: true,
        noCache: extras?.noCache === true,
        subsequentRequestToken: question && webConversationTurnsRef.current < 3 ? webConversationTokenRef.current : undefined,
      };
      const payload = question
        ? await searchPublicWebKnowledge(question, options)
        : await searchStorageWebInsight(buildStorageQueryContext(toWebSafeScanItems(nextItems), resolveDevicePlatform()), options);
      if (!mountedRef.current || webFetchGeneration.current !== generation) return;
      setAIAnalysis(applySearchPayload(analysis, payload));
      if (question && isUsableSearchPayload(payload) && !payload.disabled) {
        webConversationTurnsRef.current += 1;
        if (webConversationTurnsRef.current >= 3) {
          webConversationTokenRef.current = undefined;
          webConversationTurnsRef.current = 0;
        }
      } else if (!question) {
        webConversationTurnsRef.current = 0;
      }
      const synced = quotaStateFromRemaining(payload.quotaRemaining, isPro);
      if (synced) persistWebQuota(synced);
      else if (!payload.disabled && !payload.fromCache && isUsableSearchPayload(payload)) persistWebQuota(nextQuotaState(quota));
    } catch (error) {
      if (mountedRef.current && webFetchGeneration.current === generation) {
        setAIAnalysis(attachWebInsight(analysis, emptyWebInsight("error", question ?? "", errorCodeFromUnknown(error))));
      }
      logger.warn("web_insight_failed", { scanId: analysis.analyzerVersion });
    }
  };

  const analyzeWithAI = async (scanId: string, nextItems: CleanupItem[]) => {
    if (!mountedRef.current) return;
    setIsAnalyzingAI(true);
    try {
      const analysis = await runAIAnalysis({
        scanId,
        items: nextItems,
        largeFileThresholdMb: largeFileThreshold,
      });
      if (!mountedRef.current) {
        return;
      }
      const available = isWebIntelligenceFlagEnabled();
      const optedIn = webIntelligenceEnabled;
      webConversationTokenRef.current = undefined;
      webConversationTurnsRef.current = 0;
      setAIAnalysis(
        attachWebInsight(analysis, emptyWebInsight(available ? (optedIn ? "loading" : "off") : "disabled")),
      );
      setIsAnalyzingAI(false);
      if (available && optedIn) {
        await fetchWebInsight(analysis, nextItems);
      }
    } catch {
      if (mountedRef.current) setAIAnalysis(null);
      logger.warn("ai_analysis_failed", { scanId });
    } finally {
      if (mountedRef.current) setIsAnalyzingAI(false);
    }
  };

  const setWebIntelligenceEnabled = (value: boolean) => {
    setWebIntelligenceEnabledState(value);
    if (!value) {
      clearCachedSearches();
      webConversationTokenRef.current = undefined;
      webConversationTurnsRef.current = 0;
      setPersistedWebInsight(null);
      setAIAnalysis((current) => (current ? attachWebInsight(current, emptyWebInsight("off")) : current));
      return;
    }
    if (aiAnalysis && isWebIntelligenceFlagEnabled()) {
      void fetchWebInsight(aiAnalysis, items);
    }
  };

  const refreshWebInsight = async () => {
    if (!aiAnalysis || !webIntelligenceEnabled || !isWebIntelligenceFlagEnabled()) return;
    const isPro = await readVerifiedPro();
    if (mountedRef.current) setIsProEntitled(isPro);
    if (!canRefreshWebInsightQuota(isPro)) return;
    webConversationTokenRef.current = undefined;
    webConversationTurnsRef.current = 0;
    await fetchWebInsight(aiAnalysis, items, undefined, { noCache: true });
  };

  const retryWebInsight = async () => {
    if (!aiAnalysis || !webIntelligenceEnabled || !isWebIntelligenceFlagEnabled()) return;
    await fetchWebInsight(aiAnalysis, items);
  };

  const askRelatedWebQuestion = async (question: string) => {
    if (!aiAnalysis || !webIntelligenceEnabled || !isWebIntelligenceFlagEnabled()) return;
    await fetchWebInsight(aiAnalysis, items, question);
  };

  const completeCleanup = async () => {
    if (!canStartCleanup(cleanupInFlight.current)) return;
    cleanupInFlight.current = true;
    const selected = getSelectedCleanupItems(items);
    let deletionResult: DeletionResult;
    try {
      deletionResult = await deleteNativeMedia(selected);
    } catch {
      deletionResult = { mode: "native", status: "failed", requested: selected.length, deleted: 0 };
    }
    if (!mountedRef.current) {
      cleanupInFlight.current = false;
      return;
    }
    setLastDeletionResult(deletionResult);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoExpiresAt(null);
    if (deletionResult.mode === "fallback" || deletionResult.status === "deleted") {
      setLastCleanupSummary(createCleanupSummary(items));
      setItems((current) => removeSelectedItems(current));
      setLastScanLabel("Cleaned just now");
      const undoAvailableForHistory = canUndoCleanup(deletionResult.mode, deletionResult.status);
      setCleanupHistory((history) => [{ id: `${Date.now()}`, completedAt: Date.now(), reclaimedBytes: createCleanupSummary(items).reclaimedBytes, itemCount: selected.length, status: "completed" as const, undoAvailable: undoAvailableForHistory }, ...history].slice(0, 20));
      if (undoAvailableForHistory) {
        setUndoItems(selected);
        const expiresAt = Date.now() + 30_000;
        setUndoExpiresAt(expiresAt);
        undoTimer.current = setTimeout(() => {
          if (!canApplyUndoExpiryCallback(mountedRef.current)) return;
          setUndoItems(null);
          setUndoExpiresAt(null);
          undoTimer.current = null;
        }, 30_000);
      } else {
        setUndoItems(null);
      }
    } else {
      setUndoItems(null);
      setUndoExpiresAt(null);
      setCleanupHistory((history) => [{ id: `${Date.now()}`, completedAt: Date.now(), reclaimedBytes: 0, itemCount: selected.length, status: (deletionResult.status === "partial" ? "partial" : "failed") as CleanupHistoryEntry["status"], undoAvailable: false }, ...history].slice(0, 20));
      setLastCleanupSummary({ reclaimedBytes: 0, itemCount: 0 });
      setLastScanLabel("Cleanup needs attention");
    }
    cleanupInFlight.current = false;
  };

  const undoCleanup = () => {
    const now = Date.now();
    const pendingUndoItems = undoItems;
    if (!canStartUndoRestore(mountedRef.current, pendingUndoItems?.length ?? 0, now, undoExpiresAt)) {
      if (!mountedRef.current || !pendingUndoItems?.length) return;
    }
    if (!pendingUndoItems) return;
    if (!canRestoreUndo(now, undoExpiresAt)) {
      setUndoItems(null);
      setUndoExpiresAt(null);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      return;
    }
    setItems((current) => restoreCleanupItems(current, pendingUndoItems));
    setUndoItems(null);
    setUndoExpiresAt(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setLastCleanupSummary(null);
    setLastDeletionResult(null);
    setLastScanLabel("Cleanup undone");
  };

  const applySmartSelection = () => {
    if (!aiAnalysis || !getAIActionPolicy().canAutoSelect) return;
    setItems((current) => applyLowRiskSelection(current, aiAnalysis.recommendations));
  };

  const smartSelectedBytes = aiAnalysis
    ? aiAnalysis.recommendations
        .filter((recommendation) => recommendation.action === "safe-to-remove" && recommendation.riskLevel === "low")
        .reduce((sum, recommendation) => sum + recommendation.estimatedSavingsMb, 0)
    : 0;

  const getRecommendationByItemId = (itemId: string) =>
    aiAnalysis?.recommendations.find((recommendation) => recommendation.itemId === itemId) ?? null;

  const webIntelligenceAvailable = isWebIntelligenceFlagEnabled();
  const normalizedQuota = normalizeQuotaState(webQuota);
  const webInsightQuotaRemaining = Math.max(0, getDailySearchLimit(isProEntitled) - normalizedQuota.count);
  const webInsight = aiAnalysis?.webInsight ?? persistedWebInsight;
  const canRefreshWebInsight = Boolean(
    aiAnalysis && webIntelligenceEnabled && webIntelligenceAvailable && canRefreshWebInsightQuota(isProEntitled) && canConsumeDailySearch(normalizedQuota.count, isProEntitled),
  );
  const canRetryWebInsight = Boolean(
    aiAnalysis && webIntelligenceEnabled && webIntelligenceAvailable && webInsight?.status === "error" && webInsight.errorCode !== "quota" && canConsumeDailySearch(normalizedQuota.count, isProEntitled),
  );

  const value = useMemo(() => ({ items, isHydrated, isScanning, isScanPaused, scanSessionState, scanTimeoutMs, scanDiagnosticCounters, persistenceWarning, retryPersistence, persistenceRetrying, cycleScanTimeout, pauseScan, resumeScan, scanProgress, scannerMode, discoveredItemCount, scanCategory, lastScanLabel, lastScanDiagnostic, permissionReadiness, permissionAnnouncement, refreshPermissionReadiness, openPermissionSettings, lastCleanupSummary, lastDeletionResult, recoverPermission, scanHistory, cleanupHistory, selectedBytes: calculateSelectedBytes(items), protectedCount: items.filter((item) => item.protected).length, largeFileThreshold, setLargeFileThreshold: updateLargeFileThreshold, startScan, retryScan, cancelScan, toggleItem, selectCategory, toggleProtected, completeCleanup, clearHistory, clearCleanupHistory, canUndoCleanup: Boolean(undoItems?.length && undoExpiresAt && undoExpiresAt > Date.now()), undoExpiresAt, undoCleanup, aiAnalysis, isAnalyzingAI, applySmartSelection, smartSelectedBytes, getRecommendationByItemId, webIntelligenceEnabled, webIntelligenceAvailable, setWebIntelligenceEnabled, refreshWebInsight, retryWebInsight, askRelatedWebQuestion, canRefreshWebInsight, canRetryWebInsight, webInsightQuotaRemaining, webInsight }), [items, isHydrated, isScanning, isScanPaused, scanSessionState, scanTimeoutMs, scanDiagnosticCounters, persistenceWarning, retryPersistence, persistenceRetrying, scanProgress, scannerMode, discoveredItemCount, scanCategory, lastScanLabel, lastScanDiagnostic, permissionReadiness, permissionAnnouncement, lastCleanupSummary, lastDeletionResult, scanHistory, cleanupHistory, largeFileThreshold, undoItems, undoExpiresAt, aiAnalysis, isAnalyzingAI, smartSelectedBytes, webIntelligenceEnabled, webIntelligenceAvailable, canRefreshWebInsight, canRetryWebInsight, webInsightQuotaRemaining, webInsight]);
  return <CleanerContext.Provider value={value}>{children}</CleanerContext.Provider>;
}

export function useCleaner() {
  const context = useContext(CleanerContext);
  if (!context) throw new Error("useCleaner must be used within CleanerProvider");
  return context;
}

export { formatStorage } from "./cleaner-logic";
