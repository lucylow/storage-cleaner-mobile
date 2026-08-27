import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { canShowUpgradePrompt } from "./monetization-logic";
import { enqueuePreferenceWrite } from "./theme-logic";

const ENTITLEMENT_KEY = "storage-cleaner-entitlement-v1";
const PROMPT_KEY = "storage-cleaner-upgrade-prompt-v1";
const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

type PersistedEntitlement = { isPro: boolean; source: "verified-store" | "preview" };
type PromptState = { lastShownAt: number | null; dismissed: boolean };
type PremiumContextValue = {
  isPro: boolean;
  isHydrated: boolean;
  entitlementSource: PersistedEntitlement["source"] | null;
  setVerifiedEntitlement: (active: boolean) => Promise<void>;
  shouldShowUpgradePrompt: (now?: number) => boolean;
  recordUpgradePromptShown: (now?: number) => Promise<void>;
  dismissUpgradePrompt: () => Promise<void>;
};

const PremiumContext = createContext<PremiumContextValue | null>(null);

function isValidPromptState(value: unknown): value is PromptState {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<PromptState>;
  return (entry.lastShownAt === null || (typeof entry.lastShownAt === "number" && Number.isFinite(entry.lastShownAt) && entry.lastShownAt >= 0)) && typeof entry.dismissed === "boolean";
}

function isValidEntitlement(value: unknown): value is PersistedEntitlement {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<PersistedEntitlement>;
  return typeof entry.isPro === "boolean" && (entry.source === "verified-store" || entry.source === "preview");
}

export function PremiumProvider({ children }: { children: ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [entitlementSource, setEntitlementSource] = useState<PersistedEntitlement["source"] | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [promptState, setPromptState] = useState<PromptState>({ lastShownAt: null, dismissed: false });
  const premiumWriteQueue = useRef(Promise.resolve());

  const persistPremiumValue = (key: string, value: unknown) => {
    premiumWriteQueue.current = enqueuePreferenceWrite(premiumWriteQueue.current, JSON.stringify(value), (serialized) => AsyncStorage.setItem(key, serialized));
    return premiumWriteQueue.current;
  };

  useEffect(() => {
    let active = true;
    void Promise.all([AsyncStorage.getItem(ENTITLEMENT_KEY), AsyncStorage.getItem(PROMPT_KEY)])
      .then(([entitlementValue, promptValue]) => {
        if (!active) return;
        try {
          const parsedEntitlement = entitlementValue ? JSON.parse(entitlementValue) : null;
          if (isValidEntitlement(parsedEntitlement)) {
            setIsPro(parsedEntitlement.isPro);
            setEntitlementSource(parsedEntitlement.source);
          }
          const parsedPrompt = promptValue ? JSON.parse(promptValue) : null;
          if (isValidPromptState(parsedPrompt)) setPromptState(parsedPrompt);
        } catch {
          // Invalid local monetization state is ignored; free access remains safe.
        }
        setIsHydrated(true);
      })
      .catch(() => {
        if (active) setIsHydrated(true);
      });
    return () => { active = false; };
  }, []);

  const setVerifiedEntitlement = async (active: boolean) => {
    const next: PersistedEntitlement = { isPro: active, source: "verified-store" };
    setIsPro(active);
    setEntitlementSource(next.source);
    await persistPremiumValue(ENTITLEMENT_KEY, next);
  };

  const shouldShowUpgradePrompt = (now = Date.now()) => !isPro && canShowUpgradePrompt(promptState.lastShownAt, promptState.dismissed, now, PROMPT_COOLDOWN_MS);
  const recordUpgradePromptShown = async (now = Date.now()) => {
    const next = { ...promptState, lastShownAt: now };
    setPromptState(next);
    await persistPremiumValue(PROMPT_KEY, next);
  };
  const dismissUpgradePrompt = async () => {
    const next = { ...promptState, dismissed: true };
    setPromptState(next);
    await persistPremiumValue(PROMPT_KEY, next);
  };

  const value = useMemo(() => ({ isPro, isHydrated, entitlementSource, setVerifiedEntitlement, shouldShowUpgradePrompt, recordUpgradePromptShown, dismissUpgradePrompt }), [isPro, isHydrated, entitlementSource, promptState]);
  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium() {
  const context = useContext(PremiumContext);
  if (!context) throw new Error("usePremium must be used within PremiumProvider");
  return context;
}

export { ENTITLEMENT_KEY, PROMPT_KEY, isValidEntitlement, isValidPromptState };
