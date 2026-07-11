import { createHmac } from "node:crypto";

export const SITE_ANALYTICS_TIME_ZONE = "America/Sao_Paulo";
export const SITE_ANALYTICS_RANGES = [7, 30, 90] as const;
export type SiteAnalyticsRange = (typeof SITE_ANALYTICS_RANGES)[number];

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SITE_ANALYTICS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const knownBots = [
  "bot",
  "crawler",
  "spider",
  "headless",
  "lighthouse",
  "pagespeed",
  "google-inspectiontool",
  "facebookexternalhit",
  "whatsapp"
];

export function parseSiteAnalyticsRange(value: unknown): SiteAnalyticsRange {
  const parsed = Number(value);
  return SITE_ANALYTICS_RANGES.includes(parsed as SiteAnalyticsRange) ? (parsed as SiteAnalyticsRange) : 7;
}

export function normalizeAnalyticsIdentifier(value: unknown) {
  const normalized = String(value || "").trim();
  if (normalized.length < 12 || normalized.length > 96) return null;
  return /^[a-zA-Z0-9_-]+$/.test(normalized) ? normalized : null;
}

export function normalizeAnalyticsPath(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  const path = raw.split(/[?#]/, 1)[0].replace(/\/{2,}/g, "/").slice(0, 220);
  if (!path || path.startsWith("/admin") || path.startsWith("/api")) return null;
  return path;
}

export function normalizeAnalyticsAttribution(value: unknown) {
  const normalized = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 180);
  return normalized || null;
}

export function normalizeReferrerHost(value: unknown, ownHost?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const hostname = new URL(raw).hostname.toLowerCase().replace(/^www\./, "").slice(0, 160);
    const normalizedOwnHost = String(ownHost || "")
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/:\d+$/, "");
    if (!hostname || hostname === normalizedOwnHost) return null;
    return hostname;
  } catch {
    return null;
  }
}

export function hmacAnalyticsValue(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function brazilDateKey(date = new Date()) {
  const parts = dateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Nao foi possivel calcular a data de Sao Paulo.");
  return `${year}-${month}-${day}`;
}

export function eventDateFromKey(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

export function analyticsDateKeys(range: SiteAnalyticsRange, now = new Date()) {
  const [year, month, day] = brazilDateKey(now).split("-").map(Number);
  return Array.from({ length: range }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day - (range - index - 1)));
    return date.toISOString().slice(0, 10);
  });
}

export function previousBrazilDateKey(now = new Date()) {
  const [year, month, day] = brazilDateKey(now).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

export function analyticsPercentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function analyticsRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - 90 * 86_400_000);
}

export function isAnalyticsBot(userAgent: string) {
  const normalized = userAgent.toLowerCase();
  return !normalized || knownBots.some((bot) => normalized.includes(bot));
}

export function analyticsDeviceType(userAgent: string) {
  const normalized = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|silk/.test(normalized)) return "TABLET";
  if (/mobi|iphone|ipod|android/.test(normalized)) return "MOBILE";
  return "DESKTOP";
}
