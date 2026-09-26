export type PurchaseAnalyticsChannel = "purchase" | "google_ads";

export type PurchaseDedupeEntry = {
  purchaseSentAt?: number;
  googleAdsSentAt?: number;
};

export type PurchaseDedupeLedger = Record<string, PurchaseDedupeEntry>;

export const PURCHASE_DEDUPE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const PURCHASE_DEDUPE_MAX_ENTRIES = 64;

const PURCHASE_STATUS_POLL_DELAYS_MS = [2_000, 3_000, 5_000, 8_000, 13_000, 21_000, 34_000, 55_000, 60_000, 60_000, 60_000] as const;
const PURCHASE_TRACKING_RETRY_DELAYS_MS = [250, 500, 1_000, 2_000, 4_000, 8_000] as const;

export function isPaymentConfirmed(paymentStatus: string | null | undefined, paidAt: Date | string | null | undefined) {
  return paymentStatus === "PAID" || Boolean(paidAt);
}

export function isPurchaseQualifiedOrder(status: string, paymentConfirmed: boolean) {
  return paymentConfirmed && (status === "PAID" || status === "FULFILLING" || status === "SHIPPED");
}

export function shouldPollPurchaseConfirmation(status: string, paymentConfirmed: boolean) {
  if (paymentConfirmed) return false;
  return status === "PENDING_PAYMENT" || status === "PAID" || status === "FULFILLING" || status === "SHIPPED";
}

export function purchaseStatusPollDelay(attempt: number) {
  if (!Number.isInteger(attempt) || attempt < 0 || attempt >= PURCHASE_STATUS_POLL_DELAYS_MS.length) return null;
  return PURCHASE_STATUS_POLL_DELAYS_MS[attempt];
}

export function purchaseTrackingRetryDelay(attempt: number) {
  if (!Number.isInteger(attempt) || attempt < 0 || attempt >= PURCHASE_TRACKING_RETRY_DELAYS_MS.length) return null;
  return PURCHASE_TRACKING_RETRY_DELAYS_MS[attempt];
}

function shortHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function purchaseDedupeKey(transactionId: string) {
  const normalized = transactionId.trim();
  const readable = normalized.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 72) || "unknown";
  return `purchase:${readable}:${shortHash(normalized)}`;
}

function sentAt(entry: PurchaseDedupeEntry) {
  return Math.max(entry.purchaseSentAt || 0, entry.googleAdsSentAt || 0);
}

export function parsePurchaseDedupeLedger(raw: string | null, now = Date.now()): PurchaseDedupeLedger {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed)
        .flatMap(([key, value]) => {
          if (!key.startsWith("purchase:") || key.length > 112 || !value || typeof value !== "object" || Array.isArray(value)) return [];
          const candidate = value as PurchaseDedupeEntry;
          const purchaseSentAt = Number(candidate.purchaseSentAt);
          const googleAdsSentAt = Number(candidate.googleAdsSentAt);
          const entry: PurchaseDedupeEntry = {};

          if (Number.isFinite(purchaseSentAt) && purchaseSentAt > now - PURCHASE_DEDUPE_TTL_MS && purchaseSentAt <= now + 60_000) {
            entry.purchaseSentAt = purchaseSentAt;
          }
          if (Number.isFinite(googleAdsSentAt) && googleAdsSentAt > now - PURCHASE_DEDUPE_TTL_MS && googleAdsSentAt <= now + 60_000) {
            entry.googleAdsSentAt = googleAdsSentAt;
          }

          return sentAt(entry) ? ([[key, entry]] as Array<[string, PurchaseDedupeEntry]>) : [];
        })
        .sort((left, right) => sentAt(right[1]) - sentAt(left[1]))
        .slice(0, PURCHASE_DEDUPE_MAX_ENTRIES)
    );
  } catch {
    return {};
  }
}

export function hasPurchaseChannelBeenSent(ledger: PurchaseDedupeLedger, key: string, channel: PurchaseAnalyticsChannel) {
  const entry = ledger[key];
  return channel === "purchase" ? Boolean(entry?.purchaseSentAt) : Boolean(entry?.googleAdsSentAt);
}

export function mergePurchaseDedupeLedgers(...ledgers: PurchaseDedupeLedger[]) {
  const merged: PurchaseDedupeLedger = {};
  for (const ledger of ledgers) {
    for (const [key, entry] of Object.entries(ledger)) {
      merged[key] = {
        purchaseSentAt: Math.max(merged[key]?.purchaseSentAt || 0, entry.purchaseSentAt || 0) || undefined,
        googleAdsSentAt: Math.max(merged[key]?.googleAdsSentAt || 0, entry.googleAdsSentAt || 0) || undefined
      };
    }
  }
  return parsePurchaseDedupeLedger(JSON.stringify(merged));
}

export function markPurchaseChannelSent(
  ledger: PurchaseDedupeLedger,
  key: string,
  channel: PurchaseAnalyticsChannel,
  now = Date.now()
) {
  const next: PurchaseDedupeLedger = {
    ...ledger,
    [key]: {
      ...ledger[key],
      ...(channel === "purchase" ? { purchaseSentAt: now } : { googleAdsSentAt: now })
    }
  };

  return parsePurchaseDedupeLedger(JSON.stringify(next), now);
}
