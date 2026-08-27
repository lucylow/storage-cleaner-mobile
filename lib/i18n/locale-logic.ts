import { de } from "./de";
import { en, type TranslationKey } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { pt } from "./pt";

export const SUPPORTED_LOCALES = ["en", "fr", "es", "de", "pt"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type LocalePreference = "system" | SupportedLocale;
export type TranslationVars = Record<string, string | number>;

export const DEFAULT_LOCALE: SupportedLocale = "en";
export const LOCALE_PREFERENCE_KEY = "clearspace.locale-preference.v1";

export const LOCALE_META: Record<SupportedLocale, { nativeName: string; englishName: string }> = {
  en: { nativeName: "English", englishName: "English" },
  fr: { nativeName: "Français", englishName: "French" },
  es: { nativeName: "Español", englishName: "Spanish" },
  de: { nativeName: "Deutsch", englishName: "German" },
  pt: { nativeName: "Português", englishName: "Portuguese" },
};

export const strings: Record<SupportedLocale, Record<TranslationKey, string>> = {
  en,
  fr,
  es,
  de,
  pt,
};

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(rawLocale: string | null | undefined): SupportedLocale {
  if (!rawLocale) return DEFAULT_LOCALE;
  const normalized = rawLocale.toLowerCase().replace("_", "-");
  if (isSupportedLocale(normalized)) return normalized;
  const base = normalized.split("-")[0];
  return isSupportedLocale(base) ? base : DEFAULT_LOCALE;
}

export function parseLocalePreference(raw: string | null | undefined): LocalePreference {
  if (!raw) return "system";
  if (raw === "system") return "system";
  return isSupportedLocale(raw) ? raw : "system";
}

export function resolveLocale(preference: LocalePreference, deviceLocale?: string | null): SupportedLocale {
  if (preference === "system") return normalizeLocale(deviceLocale);
  return preference;
}

export function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function translate(locale: SupportedLocale, key: TranslationKey, vars?: TranslationVars): string {
  const catalog = strings[locale] ?? strings.en;
  return interpolate(catalog[key] ?? strings.en[key], vars);
}

export function detectDeviceLocale(): string {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().locale;
    if (resolved) return resolved;
  } catch {
    /* Intl is optional in some runtimes */
  }
  if (typeof navigator !== "undefined") {
    const nav = navigator as { language?: string; languages?: readonly string[] };
    if (nav.language) return nav.language;
    if (nav.languages?.[0]) return nav.languages[0];
  }
  return DEFAULT_LOCALE;
}

export function getLocaleRecoveryMessage(): string {
  return "Language preference could not be saved locally. Your files were not affected.";
}

export { type TranslationKey };
