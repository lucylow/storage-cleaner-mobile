export type StorageCleanupCategory = "duplicates" | "large" | "temporary";

export type StorageQueryCategory = {
  category: StorageCleanupCategory;
  reclaimableBytes: number;
  itemCount: number;
};

export type StorageQueryContext = {
  platform: "ios" | "android" | "web";
  categories: StorageQueryCategory[];
};

const PLATFORM_LABEL: Record<StorageQueryContext["platform"], string> = {
  ios: "iOS",
  android: "Android",
  web: "mobile devices",
};

type QueryLanguage = "en" | "fr" | "es" | "de" | "pt";

const PRIMARY_QUERY: Record<QueryLanguage, Record<StorageCleanupCategory, (os: string) => string>> = {
  en: {
    duplicates: (os) => `How to review duplicate photos on ${os} and keep one original`,
    large: (os) => `What large video files are safe to offload on ${os}`,
    temporary: (os) => `Is it safe to remove temporary cache files on ${os}`,
  },
  fr: {
    duplicates: (os) => `Comment examiner les photos en double sur ${os} et garder un original`,
    large: (os) => `Quels fichiers video volumineux peut-on retirer de ${os}`,
    temporary: (os) => `Est-il sur de supprimer le cache temporaire sur ${os}`,
  },
  es: {
    duplicates: (os) => `Como revisar fotos duplicadas en ${os} y conservar el original`,
    large: (os) => `Que videos grandes son seguros para quitar en ${os}`,
    temporary: (os) => `Es seguro eliminar el cache temporal en ${os}`,
  },
  de: {
    duplicates: (os) => `Wie pruefe ich doppelte Fotos auf ${os} und behalte ein Original`,
    large: (os) => `Welche grossen Video Dateien sind auf ${os} sicher zu entfernen`,
    temporary: (os) => `Ist es sicher temporaere Cache Dateien auf ${os} zu entfernen`,
  },
  pt: {
    duplicates: (os) => `Como revisar fotos duplicadas no ${os} e manter um original`,
    large: (os) => `Que ficheiros de video grandes sao seguros para remover no ${os}`,
    temporary: (os) => `E seguro remover ficheiros temporarios de cache no ${os}`,
  },
};

const CATEGORY_PHRASE: Record<QueryLanguage, Record<StorageCleanupCategory, string>> = {
  en: { duplicates: "duplicate photos", large: "large video files", temporary: "temporary cache files" },
  fr: { duplicates: "les photos en double", large: "les fichiers video volumineux", temporary: "le cache temporaire" },
  es: { duplicates: "fotos duplicadas", large: "videos grandes", temporary: "archivos temporales de cache" },
  de: { duplicates: "doppelte Fotos", large: "grosse Video Dateien", temporary: "temporaere Cache Dateien" },
  pt: { duplicates: "fotos duplicadas", large: "ficheiros de video grandes", temporary: "ficheiros temporarios de cache" },
};

const MIXED_QUERY: Record<QueryLanguage, (first: string, second: string, os: string) => string> = {
  en: (first, second, os) => `How to review ${first} and ${second} on ${os} safely`,
  fr: (first, second, os) => `Comment examiner ${first} et ${second} sur ${os}`,
  es: (first, second, os) => `Como revisar ${first} y ${second} en ${os}`,
  de: (first, second, os) => `Wie pruefe ich ${first} und ${second} auf ${os}`,
  pt: (first, second, os) => `Como revisar ${first} e ${second} no ${os}`,
};

function queryLanguageFrom(language?: string): QueryLanguage {
  const base = (language ?? "en").toLowerCase().split(/[-_]/)[0] ?? "en";
  return base in PRIMARY_QUERY ? (base as QueryLanguage) : "en";
}

export function buildStorageQueryContext(
  items: Array<{ category: StorageCleanupCategory; size: number }>,
  platform: StorageQueryContext["platform"],
): StorageQueryContext {
  const categories: StorageQueryCategory[] = (["duplicates", "large", "temporary"] as StorageCleanupCategory[]).map(
    (category) => {
      const matches = items.filter((item) => item.category === category);
      return {
        category,
        itemCount: matches.length,
        reclaimableBytes: matches.reduce((sum, item) => sum + item.size, 0),
      };
    },
  );
  return { platform, categories };
}

export function buildStorageWebQueries(context: StorageQueryContext, language = "en"): string[] {
  const ranked = [...context.categories]
    .filter((entry) => entry.itemCount > 0 && entry.reclaimableBytes > 0)
    .sort((left, right) => right.reclaimableBytes - left.reclaimableBytes);
  if (!ranked.length) return [];

  const os = PLATFORM_LABEL[context.platform];
  const locale = queryLanguageFrom(language);
  const templates = PRIMARY_QUERY[locale];
  if (ranked[1]) {
    const mixed = MIXED_QUERY[locale](
      CATEGORY_PHRASE[locale][ranked[0].category],
      CATEGORY_PHRASE[locale][ranked[1].category],
      os,
    );
    return [mixed, templates[ranked[0].category](os)];
  }
  return [templates[ranked[0].category](os)];
}
