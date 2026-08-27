import { describe, expect, it } from "vitest";
import { BRAND } from "../lib/branding";
import {
  DEFAULT_LOCALE,
  LOCALE_META,
  SUPPORTED_LOCALES,
  interpolate,
  normalizeLocale,
  parseLocalePreference,
  resolveLocale,
  strings,
  translate,
} from "../lib/i18n/locale-logic";
import { en } from "../lib/i18n/en";

describe("i18n locale logic", () => {
  it("supports English, French, Spanish, German, and Portuguese", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "fr", "es", "de", "pt"]);
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_META[locale].nativeName.length).toBeGreaterThan(0);
    }
  });

  it("keeps every locale catalog aligned with English keys", () => {
    const englishKeys = Object.keys(en).sort();
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(strings[locale]).sort()).toEqual(englishKeys);
    }
  });

  it("normalizes regional locales and falls back to English", () => {
    expect(normalizeLocale("fr-FR")).toBe("fr");
    expect(normalizeLocale("es_MX")).toBe("es");
    expect(normalizeLocale("pt-BR")).toBe("pt");
    expect(normalizeLocale("de-DE")).toBe("de");
    expect(normalizeLocale("zh-CN")).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE);
  });

  it("resolves system preference against the device locale", () => {
    expect(parseLocalePreference("fr")).toBe("fr");
    expect(parseLocalePreference("unknown")).toBe("system");
    expect(resolveLocale("system", "es-ES")).toBe("es");
    expect(resolveLocale("de", "en-US")).toBe("de");
  });

  it("interpolates placeholders without leaking leftover tokens when values exist", () => {
    expect(interpolate("{size} ready to reclaim", { size: "1.8 GB" })).toBe("1.8 GB ready to reclaim");
    expect(interpolate("{missing} stays", {})).toBe("{missing} stays");
  });

  it("translates user-facing chrome for each supported locale", () => {
    expect(translate("en", "smartScan")).toBe("Smart Scan");
    expect(translate("fr", "smartScan")).toBe("Analyse intelligente");
    expect(translate("es", "settingsTitle")).toBe("Ajustes");
    expect(translate("de", "tabHome")).toBe("Start");
    expect(translate("pt", "languageTitle")).toBe("Idioma da aplicação");
    expect(translate("fr", "readyToReclaim", { size: "2 GB" })).toBe("2 GB prêt à récupérer");
    expect(translate("es", "liveWebTipsRetry")).toBe("Reintentar");
    expect(translate("de", "liveWebTipsQuotaLeft", { count: 4 })).toContain("4");
  });

  it("keeps the ClearSpace AI product name consistent across locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(translate(locale, "appName")).toBe(BRAND.name);
      expect(translate(locale, "premiumName")).toBe(BRAND.premiumName);
    }
  });

  it("does not expose file paths or media identifiers in translation catalogs", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const blob = Object.values(strings[locale]).join(" ");
      expect(blob).not.toMatch(/\/Users\/|C:\\|\.jpg|\.mp4/i);
    }
  });
});
