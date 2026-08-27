import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Appearance, View, useColorScheme as useSystemColorScheme } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";

import { SchemeColors, type ColorScheme } from "@/constants/theme";
import { enqueuePreferenceWrite, getThemePreferenceRecoveryMessage, mergeThemePreferences, resolveThemePreferences, type StoredThemePreferences } from "@/lib/theme-logic";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  reducedMotion: boolean;
  setReducedMotion: (enabled: boolean) => void;
  preferenceWarning: string | null;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_PREFERENCES_KEY = "storage-cleaner.theme-preferences.v1";

type StoredPreferences = Partial<StoredThemePreferences>;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? "light";
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(systemScheme);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [preferenceWarning, setPreferenceWarning] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const preferencesRef = useRef<StoredThemePreferences>({ colorScheme: systemScheme, reducedMotion: false });
  const preferenceWriteQueue = useRef(Promise.resolve());

  const applyScheme = useCallback((scheme: ColorScheme) => {
    nativewindColorScheme.set(scheme);
    Appearance.setColorScheme?.(scheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => root.style.setProperty(`--color-${token}`, value));
    }
  }, []);

  const persist = useCallback((next: StoredPreferences) => {
    const merged = mergeThemePreferences(preferencesRef.current, next);
    preferencesRef.current = merged;
    let serialized: string;
    try {
      serialized = JSON.stringify(merged);
    } catch {
      return;
    }
    preferenceWriteQueue.current = enqueuePreferenceWrite(
      preferenceWriteQueue.current,
      serialized,
      (value) => AsyncStorage.setItem(THEME_PREFERENCES_KEY, value),
      () => { if (mountedRef.current) setPreferenceWarning(getThemePreferenceRecoveryMessage()); },
    );
  }, []);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    setPreferenceWarning(null);
    applyScheme(scheme);
    persist({ colorScheme: scheme });
  }, [applyScheme, persist]);

  const updateReducedMotion = useCallback((enabled: boolean) => {
    setReducedMotion(enabled);
    setPreferenceWarning(null);
    persist({ reducedMotion: enabled });
  }, [persist]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(THEME_PREFERENCES_KEY).then((value) => {
      if (!active || !value) return;
      try {
        const parsed = JSON.parse(value) as StoredPreferences;
        const nextPreferences = resolveThemePreferences(parsed, systemScheme);
        preferencesRef.current = nextPreferences;
        setColorSchemeState(nextPreferences.colorScheme);
        setReducedMotion(nextPreferences.reducedMotion);
      } catch {
        if (active) setPreferenceWarning(getThemePreferenceRecoveryMessage());
      }
    }).catch(() => { if (active) setPreferenceWarning(getThemePreferenceRecoveryMessage()); });
    return () => { active = false; mountedRef.current = false; };
  }, []);

  useEffect(() => { applyScheme(colorScheme); }, [applyScheme, colorScheme]);

  const themeVariables = useMemo(() => vars({
    "color-primary": SchemeColors[colorScheme].primary,
    "color-background": SchemeColors[colorScheme].background,
    "color-surface": SchemeColors[colorScheme].surface,
    "color-foreground": SchemeColors[colorScheme].foreground,
    "color-muted": SchemeColors[colorScheme].muted,
    "color-border": SchemeColors[colorScheme].border,
    "color-success": SchemeColors[colorScheme].success,
    "color-warning": SchemeColors[colorScheme].warning,
    "color-error": SchemeColors[colorScheme].error,
  }), [colorScheme]);

  const value = useMemo(() => ({ colorScheme, setColorScheme, reducedMotion, setReducedMotion: updateReducedMotion, preferenceWarning }), [colorScheme, reducedMotion, setColorScheme, updateReducedMotion, preferenceWarning]);
  return <ThemeContext.Provider value={value}><View style={[{ flex: 1 }, themeVariables]}>{children}</View></ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeContext must be used within ThemeProvider");
  return ctx;
}
