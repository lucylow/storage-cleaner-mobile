type Primitive = string | number | boolean | null | undefined;
type SafeValue = Primitive | SafeValue[] | { [key: string]: SafeValue };

const REDACTED = "[redacted]";

function redactString(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, REDACTED)
    .replace(/(?:token|auth|key|secret|password)=([^&\s]+)/gi, (_m, _v) => `token=${REDACTED}`)
    .replace(/(?:https?:\/\/)[^\s]+/gi, (url) => {
      const [base] = url.split("?");
      return `${base}?${REDACTED}`;
    })
    .replace(/(?:[A-Za-z]:[\\/]|\/|ph:\/\/)[^\s,;]+/g, REDACTED)
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, REDACTED);
}

function sanitize(value: unknown): SafeValue {
  if (value == null) return value as null | undefined;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((entry) => sanitize(entry));
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      key.toLowerCase().includes("name") || key.toLowerCase().includes("path") || key.toLowerCase().includes("email")
        ? REDACTED
        : sanitize(entry),
    ]);
    return Object.fromEntries(entries);
  }
  return REDACTED;
}

function log(level: "info" | "warn" | "error", event: string, payload?: Record<string, unknown>) {
  const safePayload = payload ? sanitize(payload) : undefined;
  if (level === "error") {
    console.error(event, safePayload);
    return;
  }
  if (level === "warn") {
    console.warn(event, safePayload);
    return;
  }
  console.log(event, safePayload);
}

export const logger = {
  info: (event: string, payload?: Record<string, unknown>) => log("info", event, payload),
  warn: (event: string, payload?: Record<string, unknown>) => log("warn", event, payload),
  error: (event: string, payload?: Record<string, unknown>) => log("error", event, payload),
};
