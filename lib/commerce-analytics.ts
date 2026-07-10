export type OrderAttribution = {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
};

type CommerceItem = {
  item_id: string;
  item_name?: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
};

type GtagPayload = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (command: "event" | "config", eventName: string, payload?: GtagPayload) => void;
  }
}

const ATTRIBUTION_KEY = "rosagiro:attribution:v1";
const EVENT_KEY_PREFIX = "rosagiro:event:";
const attributionKeys: Array<[keyof OrderAttribution, string]> = [
  ["gclid", "gclid"],
  ["gbraid", "gbraid"],
  ["wbraid", "wbraid"],
  ["utmSource", "utm_source"],
  ["utmMedium", "utm_medium"],
  ["utmCampaign", "utm_campaign"],
  ["utmTerm", "utm_term"],
  ["utmContent", "utm_content"]
];

function cleanAttributionValue(value: string | null) {
  const normalized = String(value || "").trim().slice(0, 180);
  return /^[a-zA-Z0-9._~%+=:@/-]+$/.test(normalized) ? normalized : "";
}

function storageGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Analytics storage is optional and should never block checkout.
  }
}

export function captureAttributionFromLocation() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const next: OrderAttribution = {};
  for (const [field, queryKey] of attributionKeys) {
    const value = cleanAttributionValue(params.get(queryKey));
    if (value) next[field] = value;
  }
  if (!Object.keys(next).length) return;
  storageSet(ATTRIBUTION_KEY, JSON.stringify({ ...readAttribution(), ...next, capturedAt: Date.now() }));
}

export function readAttribution(): OrderAttribution {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(storageGet(ATTRIBUTION_KEY) || "{}") as OrderAttribution & { capturedAt?: number };
    if (raw.capturedAt && Date.now() - raw.capturedAt > 90 * 24 * 60 * 60 * 1000) return {};
    return Object.fromEntries(
      attributionKeys
        .map(([field]) => [field, cleanAttributionValue(raw[field] || null)])
        .filter(([, value]) => Boolean(value))
    ) as OrderAttribution;
  } catch {
    return {};
  }
}

export function trackCommerceEvent(eventName: string, payload: GtagPayload = {}) {
  if (typeof window === "undefined") return;
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, payload);
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(["event", eventName, payload]);
}

export function trackCommerceOnce(key: string, eventName: string, payload: GtagPayload = {}) {
  if (typeof window === "undefined") return false;
  const storageKey = `${EVENT_KEY_PREFIX}${key}`;
  try {
    if (sessionStorage.getItem(storageKey)) return false;
    sessionStorage.setItem(storageKey, "1");
  } catch {
    // Continue without dedupe if browser storage is unavailable.
  }
  trackCommerceEvent(eventName, payload);
  return true;
}

export function commerceItem(input: CommerceItem) {
  return input;
}

export function trackGoogleAdsConversion(sendTo: string | undefined, payload: GtagPayload) {
  if (!sendTo) return;
  trackCommerceEvent("conversion", { send_to: sendTo, ...payload });
}
