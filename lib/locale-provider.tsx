import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  LOCALE_META,
  LOCALE_PREFERENCE_KEY,
  SUPPORTED_LOCALES,
  detectDeviceLocale,
  parseLocalePreference,
  resolveLocale,
  translate,
  type LocalePreference,
  type SupportedLocale,
  type TranslationKey,
  type TranslationVars,
} from "@/lib/i18n/locale-logic";

type LocaleContextValue = {
  locale: SupportedLocale;
  preference: LocalePreference;
  setPreference: (preference: LocalePreference) => void;
  t: (key: TranslationKey, vars?: TranslationVars) => string;
  noun: (count: number, singularKey: TranslationKey, pluralKey: TranslationKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<LocalePreference>("system");
  const [deviceLocale, setDeviceLocale] = useState(detectDeviceLocale);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setDeviceLocale(detectDeviceLocale());
    void AsyncStorage.getItem(LOCALE_PREFERENCE_KEY)
      .then((value) => {
        if (!mountedRef.current) return;
        setPreferenceState(parseLocalePreference(value));
      })
      .catch(() => {
        /* keep system default if persistence is unavailable */
      });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setPreference = useCallback((next: LocalePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(LOCALE_PREFERENCE_KEY, next).catch(() => {
      if (mountedRef.current) {
        /* persistence failure is non-destructive */
      }
    });
  }, []);

  const locale = useMemo(() => resolveLocale(preference, deviceLocale), [preference, deviceLocale]);

  const t = useCallback((key: TranslationKey, vars?: TranslationVars) => translate(locale, key, vars), [locale]);

  const noun = useCallback(
    (count: number, singularKey: TranslationKey, pluralKey: TranslationKey) => translate(locale, count === 1 ? singularKey : pluralKey),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, preference, setPreference, t, noun }),
    [locale, noun, preference, setPreference, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslation(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useTranslation must be used within LocaleProvider");
  return context;
}

export { LOCALE_META, SUPPORTED_LOCALES };
