import assert from "node:assert/strict";
import test from "node:test";
import {
  PURCHASE_DEDUPE_MAX_ENTRIES,
  PURCHASE_DEDUPE_TTL_MS,
  hasPurchaseChannelBeenSent,
  isPaymentConfirmed,
  isPurchaseQualifiedOrder,
  markPurchaseChannelSent,
  mergePurchaseDedupeLedgers,
  parsePurchaseDedupeLedger,
  purchaseDedupeKey,
  purchaseStatusPollDelay,
  purchaseTrackingRetryDelay,
  shouldPollPurchaseConfirmation
} from "./purchase-analytics";

test("accepts either persisted payment confirmation signal", () => {
  assert.equal(isPaymentConfirmed("PAID", null), true);
  assert.equal(isPaymentConfirmed("PENDING", new Date("2026-09-26T12:00:00Z")), true);
  assert.equal(isPaymentConfirmed("PENDING", null), false);
  assert.equal(isPaymentConfirmed(undefined, undefined), false);
});

test("requires a confirmed payment signal for every purchase-qualified order state", () => {
  assert.equal(isPurchaseQualifiedOrder("PAID", true), true);
  assert.equal(isPurchaseQualifiedOrder("FULFILLING", true), true);
  assert.equal(isPurchaseQualifiedOrder("SHIPPED", true), true);
  assert.equal(isPurchaseQualifiedOrder("PAID", false), false);
  assert.equal(isPurchaseQualifiedOrder("FULFILLING", false), false);
  assert.equal(isPurchaseQualifiedOrder("SHIPPED", false), false);
  assert.equal(isPurchaseQualifiedOrder("PENDING_PAYMENT", true), false);
  assert.equal(isPurchaseQualifiedOrder("CANCELED", true), false);
});

test("polls unconfirmed nonterminal purchase states and stops after confirmation", () => {
  assert.equal(shouldPollPurchaseConfirmation("PENDING_PAYMENT", false), true);
  assert.equal(shouldPollPurchaseConfirmation("PAID", false), true);
  assert.equal(shouldPollPurchaseConfirmation("FULFILLING", false), true);
  assert.equal(shouldPollPurchaseConfirmation("SHIPPED", false), true);
  assert.equal(shouldPollPurchaseConfirmation("PENDING_PAYMENT", true), false);
  assert.equal(shouldPollPurchaseConfirmation("PAID", true), false);
  assert.equal(shouldPollPurchaseConfirmation("CANCELED", false), false);
});

test("uses bounded backoff and eventually stops polling", () => {
  assert.deepEqual(
    Array.from({ length: 11 }, (_, attempt) => purchaseStatusPollDelay(attempt)),
    [2_000, 3_000, 5_000, 8_000, 13_000, 21_000, 34_000, 55_000, 60_000, 60_000, 60_000]
  );
  assert.equal(purchaseStatusPollDelay(11), null);
  assert.equal(purchaseStatusPollDelay(-1), null);
  assert.equal(purchaseStatusPollDelay(1.5), null);
});

test("bounds retries while waiting for the installed gtag transport", () => {
  assert.deepEqual(
    Array.from({ length: 6 }, (_, attempt) => purchaseTrackingRetryDelay(attempt)),
    [250, 500, 1_000, 2_000, 4_000, 8_000]
  );
  assert.equal(purchaseTrackingRetryDelay(6), null);
});

test("builds stable bounded dedupe keys from the transaction id", () => {
  const first = purchaseDedupeKey(` RG-${"A".repeat(200)} `);
  const second = purchaseDedupeKey(` RG-${"A".repeat(199)}B `);
  assert.equal(first, purchaseDedupeKey(` RG-${"A".repeat(200)} `));
  assert.notEqual(first, second);
  assert.ok(first.length <= 112);
});

test("marks channels independently and prunes stale or excessive entries", () => {
  const now = 2_000_000_000_000;
  let ledger = markPurchaseChannelSent({}, "purchase:RG-1:one", "purchase", now);
  assert.equal(hasPurchaseChannelBeenSent(ledger, "purchase:RG-1:one", "purchase"), true);
  assert.equal(hasPurchaseChannelBeenSent(ledger, "purchase:RG-1:one", "google_ads"), false);

  ledger = markPurchaseChannelSent(ledger, "purchase:RG-1:one", "google_ads", now + 1);
  assert.equal(hasPurchaseChannelBeenSent(ledger, "purchase:RG-1:one", "google_ads"), true);

  const oversized = Object.fromEntries(
    Array.from({ length: PURCHASE_DEDUPE_MAX_ENTRIES + 5 }, (_, index) => [
      `purchase:RG-${index}:hash`,
      { purchaseSentAt: now - index }
    ])
  );
  oversized["purchase:stale:hash"] = { purchaseSentAt: now - PURCHASE_DEDUPE_TTL_MS - 1 };
  const parsed = parsePurchaseDedupeLedger(JSON.stringify(oversized), now);
  assert.equal(Object.keys(parsed).length, PURCHASE_DEDUPE_MAX_ENTRIES);
  assert.equal(parsed["purchase:stale:hash"], undefined);
  assert.ok(parsed["purchase:RG-0:hash"]);
});

test("merges cross-tab ledger updates without losing either channel", () => {
  const now = Date.now();
  const key = "purchase:RG-1:one";
  const merged = mergePurchaseDedupeLedgers(
    { [key]: { purchaseSentAt: now - 2 } },
    { [key]: { purchaseSentAt: now - 1, googleAdsSentAt: now } }
  );
  assert.equal(merged[key]?.purchaseSentAt, now - 1);
  assert.equal(merged[key]?.googleAdsSentAt, now);
});

test("rejects malformed ledgers", () => {
  assert.deepEqual(parsePurchaseDedupeLedger("not json"), {});
  assert.deepEqual(parsePurchaseDedupeLedger("[]"), {});
  assert.deepEqual(parsePurchaseDedupeLedger(JSON.stringify({ invalid: { purchaseSentAt: Date.now() } })), {});
});
