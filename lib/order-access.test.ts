import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createOrderAccessGrant,
  createOrderShareGrant,
  orderAccessAllowed,
  orderAccessCookieName,
  ORDER_ACCESS_COOKIE_DAYS,
  ORDER_SHARE_GRANT_MINUTES,
  sameOriginRequest,
  verifyOrderAccessGrant,
  verifyOrderShareGrant
} from "./order-access-core";

const secret = "test-session-secret-with-enough-entropy";
const now = Date.UTC(2026, 8, 26, 12, 0, 0);
const orderNumber = "RG-ORDER-1001";
const fixedNonce = "0123456789abcdef0123456789abcdef";

test("order access fails closed without a capability or SESSION_SECRET", () => {
  assert.equal(verifyOrderAccessGrant(orderNumber, null, secret, now), false);
  assert.equal(verifyOrderAccessGrant(orderNumber, "customer-123", secret, now), false);
  assert.equal(verifyOrderAccessGrant(orderNumber, "+55 11 99999-9999", secret, now), false);
  assert.equal(verifyOrderAccessGrant(orderNumber, "anything", undefined, now), false);
  assert.throws(() => createOrderAccessGrant(orderNumber, undefined), /SESSION_SECRET/);
  assert.throws(() => orderAccessCookieName(orderNumber, undefined), /SESSION_SECRET/);
});

test("a valid per-order cookie authorizes only its signed order", () => {
  const token = createOrderAccessGrant(orderNumber, secret, { now, nonce: fixedNonce });
  assert.equal(verifyOrderAccessGrant(orderNumber, token, secret, now), true);
  assert.equal(verifyOrderAccessGrant("RG-ORDER-OTHER", token, secret, now), false);
  assert.equal(token.includes(orderNumber), false);
  assert.equal(orderAccessCookieName(orderNumber, secret).includes(orderNumber), false);
});

test("forged and expired order capabilities are rejected", () => {
  const token = createOrderAccessGrant(orderNumber, secret, { now, nonce: fixedNonce });
  const forged = `${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`;
  const expiredAt = now + ORDER_ACCESS_COOKIE_DAYS * 24 * 60 * 60 * 1000;
  assert.equal(verifyOrderAccessGrant(orderNumber, forged, secret, now), false);
  assert.equal(verifyOrderAccessGrant(orderNumber, token, secret, expiredAt), false);
});

test("manual customer identity never substitutes for a capability, while admin auth does", () => {
  assert.equal(
    orderAccessAllowed({ orderNumber, cookieValue: "customer-id-123:+5511999999999", adminAuthenticated: false, secret, now }),
    false
  );
  assert.equal(orderAccessAllowed({ orderNumber, adminAuthenticated: true, secret, now }), true);
});

test("short-lived share grants are purpose-bound, order-bound and expire", () => {
  const token = createOrderShareGrant(orderNumber, secret, { now, nonce: fixedNonce });
  const expiresAt = now + ORDER_SHARE_GRANT_MINUTES * 60 * 1000;
  assert.equal(verifyOrderShareGrant(orderNumber, token, secret, now), true);
  assert.equal(verifyOrderShareGrant("RG-ORDER-OTHER", token, secret, now), false);
  assert.equal(verifyOrderAccessGrant(orderNumber, token, secret, now), false);
  assert.equal(verifyOrderShareGrant(orderNumber, token, secret, expiresAt), false);
  assert.equal(token.includes(orderNumber), false);
});

test("same-origin POST validation rejects absent, malformed and cross-origin origins", () => {
  assert.equal(sameOriginRequest("https://rosagiro.com.br/api/orders/1", "https://rosagiro.com.br"), true);
  assert.equal(sameOriginRequest("https://rosagiro.com.br/api/orders/1", null), false);
  assert.equal(sameOriginRequest("https://rosagiro.com.br/api/orders/1", "not-a-url"), false);
  assert.equal(sameOriginRequest("https://rosagiro.com.br/api/orders/1", "https://evil.example"), false);
});
