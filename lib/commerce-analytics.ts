import { analyticsPrivacySignalEnabled } from "@/lib/browser-analytics";
import { analyticsPageContext } from "@/lib/google-tag-bootstrap";
import { getGoogleAnalyticsConsent } from "@/lib/google-analytics-consent";
import {
  hasPurchaseChannelBeenSent,
  markPurchaseChannelSent,
  mergePurchaseDedupeLedgers,
  parsePurchaseDedupeLedger,
  purchaseDedupeKey,
  type PurchaseDedupeLedger
} from "@/lib/purchase-analytics";

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
const PURCHASE_LEDGER_KEY = "rosagiro:purchase-events:v2";
export const GA4_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || "";
let purchaseMemoryLedger: PurchaseDedupeLedger = {};
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
  if (typeof window === "undefined" || analyticsPrivacySignalEnabled() || !getGoogleAnalyticsConsent()) return;
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
  if (typeof window === "undefined" || analyticsPrivacySignalEnabled() || !getGoogleAnalyticsConsent()) return {};
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
  if (typeof window === "undefined" || analyticsPrivacySignalEnabled() || !getGoogleAnalyticsConsent()) return false;
  const context = browserPageContext();
  if (context === null) return false;
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, { ...payload, ...context });
      return true;
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(["event", eventName, { ...payload, ...context }]);
    return true;
  } catch {
    return false;
  }
}

export function trackCommerceOnce(key: string, eventName: string, payload: GtagPayload = {}) {
  if (typeof window === "undefined") return false;
  const storageKey = `${EVENT_KEY_PREFIX}${key}`;
  try {
    if (sessionStorage.getItem(storageKey)) return false;
  } catch {
    // Continue without dedupe if browser storage is unavailable.
  }
  if (!trackCommerceEvent(eventName, payload)) return false;
  try {
    sessionStorage.setItem(storageKey, "1");
  } catch {
    // The event was queued successfully even if dedupe storage is unavailable.
  }
  return true;
}

export function commerceItem(input: CommerceItem) {
  return input;
}

export function trackGoogleAdsConversion(sendTo: string | undefined, payload: GtagPayload) {
  if (!sendTo) return false;
  return trackCommerceEvent("conversion", { send_to: sendTo, ...payload });
}

function readPurchaseLedger() {
  let stored: PurchaseDedupeLedger = {};
  try {
    stored = parsePurchaseDedupeLedger(localStorage.getItem(PURCHASE_LEDGER_KEY));
  } catch {
    try {
      stored = parsePurchaseDedupeLedger(sessionStorage.getItem(PURCHASE_LEDGER_KEY));
    } catch {
      // In-memory dedupe still protects repeated React effects in this page lifetime.
    }
  }
  return mergePurchaseDedupeLedgers(stored, purchaseMemoryLedger);
}

function writePurchaseLedger(ledger: PurchaseDedupeLedger) {
  purchaseMemoryLedger = ledger;
  const serialized = JSON.stringify(ledger);
  try {
    localStorage.setItem(PURCHASE_LEDGER_KEY, serialized);
    return;
  } catch {
    try {
      sessionStorage.setItem(PURCHASE_LEDGER_KEY, serialized);
    } catch {
      // Analytics storage is optional; the in-memory ledger remains available.
    }
  }
}

async function withPurchaseLock<T>(key: string, callback: () => T | Promise<T>) {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(`rosagiro:${key}`, callback);
  }
  return callback();
}

export type PurchaseTrackingOutcome = "sent" | "already_sent" | "not_configured" | "not_ready";

export type PurchaseTrackingResult = {
  ga4: PurchaseTrackingOutcome;
  googleAds: PurchaseTrackingOutcome;
  pending: boolean;
};

type PurchaseTrackingDestinations = {
  ga4MeasurementId?: string;
  googleAdsSendTo?: string;
};

function trackInstalledGtagEvent(eventName: string, payload: GtagPayload) {
  if (typeof window === "undefined" || analyticsPrivacySignalEnabled() || !getGoogleAnalyticsConsent() || typeof window.gtag !== "function") return false;
  const context = browserPageContext();
  if (context === null) return false;
  try {
    window.gtag("event", eventName, { ...payload, ...context });
    return true;
  } catch {
    return false;
  }
}

function browserPageContext() {
  if (typeof document === "undefined" || !window.location) return {};
  return analyticsPageContext(window.location, document.title, document.referrer);
}

export async function trackPurchaseOnce(
  transactionId: string,
  payload: GtagPayload,
  destinations: PurchaseTrackingDestinations
): Promise<PurchaseTrackingResult> {
  const ga4MeasurementId = destinations.ga4MeasurementId?.trim() || "";
  const googleAdsSendTo = destinations.googleAdsSendTo?.trim() || "";
  const unavailableResult: PurchaseTrackingResult = {
    ga4: ga4MeasurementId ? "not_ready" : "not_configured",
    googleAds: googleAdsSendTo ? "not_ready" : "not_configured",
    pending: Boolean(ga4MeasurementId || googleAdsSendTo)
  };
  if (!ga4MeasurementId && !googleAdsSendTo) return unavailableResult;
  if (typeof window === "undefined") return unavailableResult;
  const key = purchaseDedupeKey(transactionId);

  return withPurchaseLock(key, () => {
    let ledger = readPurchaseLedger();
    let ga4: PurchaseTrackingOutcome = ga4MeasurementId ? "not_ready" : "not_configured";
    let googleAds: PurchaseTrackingOutcome = googleAdsSendTo ? "not_ready" : "not_configured";

    if (ga4MeasurementId) {
      if (hasPurchaseChannelBeenSent(ledger, key, "purchase")) {
        ga4 = "already_sent";
      } else if (trackInstalledGtagEvent("purchase", { ...payload, send_to: ga4MeasurementId })) {
        ledger = markPurchaseChannelSent(ledger, key, "purchase");
        writePurchaseLedger(ledger);
        ga4 = "sent";
      }
    }

    if (googleAdsSendTo) {
      if (hasPurchaseChannelBeenSent(ledger, key, "google_ads")) {
        googleAds = "already_sent";
      } else if (trackInstalledGtagEvent("conversion", { send_to: googleAdsSendTo, ...payload })) {
        ledger = markPurchaseChannelSent(ledger, key, "google_ads");
        writePurchaseLedger(ledger);
        googleAds = "sent";
      }
    }

    return {
      ga4,
      googleAds,
      pending: ga4 === "not_ready" || googleAds === "not_ready"
    };
  });
}
