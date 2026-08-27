const ALLOWED_VOCABULARY = [
  "almacenamiento",
  "android",
  "app",
  "apps",
  "arquivos",
  "backup",
  "cache",
  "caches",
  "camera",
  "clean",
  "cleanup",
  "cloud",
  "copies",
  "copy",
  "dateien",
  "delete",
  "device",
  "devices",
  "doublons",
  "download",
  "downloads",
  "duplicados",
  "duplicate",
  "duplicates",
  "duplikate",
  "eliminar",
  "entfernen",
  "ficheiros",
  "fichiers",
  "file",
  "files",
  "fotos",
  "gallery",
  "gb",
  "gigabyte",
  "gigabytes",
  "google",
  "icloud",
  "ios",
  "iphone",
  "keep",
  "large",
  "mb",
  "media",
  "megabyte",
  "megabytes",
  "mobile",
  "offload",
  "optimize",
  "original",
  "originals",
  "phone",
  "photo",
  "photos",
  "reclaim",
  "remove",
  "remover",
  "review",
  "safe",
  "seguro",
  "sicher",
  "space",
  "speicher",
  "stockage",
  "storage",
  "supprimer",
  "temporary",
  "thumbnail",
  "thumbnails",
  "unused",
  "video",
  "videos",
  "whatsapp",
];

const PATH_PATTERN = /(?:[A-Za-z]:[\\/]|\/|\\\\|ph:\/\/|file:\/\/|content:\/\/)/;
const FILENAME_PATTERN = /\b[\w.-]+\.(?:jpe?g|png|gif|heic|heif|webp|mp4|mov|m4v|avi|mkv|pdf|zip|rar|7z|dng|raw)\b/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const URL_PATTERN = /https?:\/\/|www\./i;
const PHONE_PATTERN = /\b\d{6,}\b/;
const ALLOWED_CHARACTERS = /^[a-zA-ZÀ-ÿ0-9 .,'’?!+-]+$/;

function foldAscii(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function normalizeStorageQuery(query: string) {
  return foldAscii(query).replace(/[^a-z0-9]+/g, " ").trim();
}

export function isSameStorageQuery(left: string, right: string) {
  return normalizeStorageQuery(left) === normalizeStorageQuery(right);
}

export function sanitizeInsightText(markdown: string) {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*\]\(\s*(?:javascript:|data:|file:|http:\/\/)/gi, "[")
    .replace(EMAIL_PATTERN, " ")
    .replace(PHONE_PATTERN, " ")
    .replace(/(?:(?<![a-z])[a-z]:[\\/]|\/Users\/|\/var\/|\/private\/|file:\/\/|ph:\/\/|content:\/\/)\S*/gi, " ")
    .replace(FILENAME_PATTERN, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isSafeHttpsUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || !host.includes(".")) return false;
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".onion")) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) return false;
    return true;
  } catch {
    return false;
  }
}

export function isAllowedWebIntelligenceQuery(query: string): boolean {
  const normalized = query.trim();
  if (normalized.length < 8 || normalized.length > 280) return false;
  if (PATH_PATTERN.test(normalized)) return false;
  if (FILENAME_PATTERN.test(normalized)) return false;
  if (EMAIL_PATTERN.test(normalized)) return false;
  if (URL_PATTERN.test(normalized)) return false;
  if (PHONE_PATTERN.test(normalized)) return false;
  if (!ALLOWED_CHARACTERS.test(normalized)) return false;

  const tokens = foldAscii(normalized)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const hits = tokens.filter((token) => ALLOWED_VOCABULARY.includes(token));
  return hits.length >= 2;
}
