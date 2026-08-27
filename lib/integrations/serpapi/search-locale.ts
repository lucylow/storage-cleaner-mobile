export type SearchLocale = {
  language: string;
  country: string;
};

const LOCALE_TO_SEARCH: Record<string, SearchLocale> = {
  en: { language: "en", country: "us" },
  fr: { language: "fr", country: "fr" },
  es: { language: "es", country: "es" },
  de: { language: "de", country: "de" },
  pt: { language: "pt", country: "pt" },
};

export function searchLocaleFromAppLocale(locale?: string | null): SearchLocale {
  const base = (locale ?? "en").toLowerCase().split(/[-_]/)[0] ?? "en";
  return LOCALE_TO_SEARCH[base] ?? LOCALE_TO_SEARCH.en;
}
