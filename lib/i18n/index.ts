import {
  resolveLocale,
  translate,
  type TranslationKey,
  type TranslationVars,
} from "./locale-logic";

export {
  DEFAULT_LOCALE,
  LOCALE_META,
  LOCALE_PREFERENCE_KEY,
  SUPPORTED_LOCALES,
  detectDeviceLocale,
  getLocaleRecoveryMessage,
  interpolate,
  isSupportedLocale,
  normalizeLocale,
  parseLocalePreference,
  resolveLocale,
  strings,
  translate,
  type LocalePreference,
  type SupportedLocale,
  type TranslationKey,
  type TranslationVars,
} from "./locale-logic";

export function getLocale(locale?: string | null) {
  return resolveLocale("system", locale);
}

export function t(key: TranslationKey, locale?: string | null, vars?: TranslationVars) {
  return translate(resolveLocale("system", locale), key, vars);
}
