import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ORDER_ACCESS_COOKIE_DAYS = 30;
export const ORDER_SHARE_GRANT_MINUTES = 15;

const TOKEN_VERSION = "v1";
const COOKIE_PURPOSE = "order-cookie";
const SHARE_PURPOSE = "order-share";

type GrantPurpose = typeof COOKIE_PURPOSE | typeof SHARE_PURPOSE;

type CreateGrantOptions = {
  now?: number;
  nonce?: string;
};

function requireSecret(secret: string | undefined) {
  const value = String(secret || "").trim();
  if (!value) throw new Error("SESSION_SECRET is not configured.");
  return value;
}

function normalizeOrderNumber(orderNumber: string) {
  const value = String(orderNumber || "").trim();
  if (!/^[A-Za-z0-9-]{3,80}$/.test(value)) return null;
  return value;
}

function hmac(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeHexEqual(actual: string, expected: string) {
  if (!/^[a-f0-9]{64}$/i.test(actual) || !/^[a-f0-9]{64}$/i.test(expected)) return false;
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function signaturePayload(purpose: GrantPurpose, orderNumber: string, expiresAt: number, nonce: string) {
  return [TOKEN_VERSION, purpose, orderNumber, String(expiresAt), nonce].join("\n");
}

function createGrant(
  orderNumber: string,
  purpose: GrantPurpose,
  lifetimeMs: number,
  secretInput: string | undefined,
  options: CreateGrantOptions = {}
) {
  const secret = requireSecret(secretInput);
  const normalizedOrderNumber = normalizeOrderNumber(orderNumber);
  if (!normalizedOrderNumber) throw new Error("Invalid order number.");
  const now = options.now ?? Date.now();
  const expiresAt = Math.floor(now + lifetimeMs);
  const nonce = options.nonce || randomBytes(16).toString("hex");
  if (!/^[a-f0-9]{32}$/i.test(nonce)) throw new Error("Invalid grant nonce.");
  const signature = hmac(secret, signaturePayload(purpose, normalizedOrderNumber, expiresAt, nonce));
  return `${TOKEN_VERSION}.${expiresAt}.${nonce}.${signature}`;
}

function verifyGrant(
  orderNumber: string,
  token: string | null | undefined,
  purpose: GrantPurpose,
  secretInput: string | undefined,
  now = Date.now()
) {
  try {
    const secret = requireSecret(secretInput);
    const normalizedOrderNumber = normalizeOrderNumber(orderNumber);
    if (!normalizedOrderNumber || !token) return false;
    const [version, expiresRaw, nonce, signature, extra] = token.split(".");
    if (extra !== undefined || version !== TOKEN_VERSION || !/^\d{13}$/.test(expiresRaw)) return false;
    if (!/^[a-f0-9]{32}$/i.test(nonce) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
    const expiresAt = Number(expiresRaw);
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;
    const expected = hmac(secret, signaturePayload(purpose, normalizedOrderNumber, expiresAt, nonce));
    return safeHexEqual(signature, expected);
  } catch {
    return false;
  }
}

export function orderAccessCookieName(orderNumber: string, secretInput: string | undefined) {
  const secret = requireSecret(secretInput);
  const normalizedOrderNumber = normalizeOrderNumber(orderNumber);
  if (!normalizedOrderNumber) throw new Error("Invalid order number.");
  const scope = hmac(secret, `order-cookie-name\n${normalizedOrderNumber}`).slice(0, 24);
  return `rg_order_access_${scope}`;
}

export function createOrderAccessGrant(
  orderNumber: string,
  secret: string | undefined,
  options: CreateGrantOptions = {}
) {
  return createGrant(orderNumber, COOKIE_PURPOSE, ORDER_ACCESS_COOKIE_DAYS * 24 * 60 * 60 * 1000, secret, options);
}

export function verifyOrderAccessGrant(
  orderNumber: string,
  token: string | null | undefined,
  secret: string | undefined,
  now = Date.now()
) {
  return verifyGrant(orderNumber, token, COOKIE_PURPOSE, secret, now);
}

export function createOrderShareGrant(
  orderNumber: string,
  secret: string | undefined,
  options: CreateGrantOptions = {}
) {
  return createGrant(orderNumber, SHARE_PURPOSE, ORDER_SHARE_GRANT_MINUTES * 60 * 1000, secret, options);
}

export function verifyOrderShareGrant(
  orderNumber: string,
  token: string | null | undefined,
  secret: string | undefined,
  now = Date.now()
) {
  return verifyGrant(orderNumber, token, SHARE_PURPOSE, secret, now);
}

export function orderAccessAllowed(input: {
  orderNumber: string;
  cookieValue?: string | null;
  adminAuthenticated?: boolean;
  secret?: string;
  now?: number;
}) {
  if (input.adminAuthenticated === true) return true;
  return verifyOrderAccessGrant(input.orderNumber, input.cookieValue, input.secret, input.now);
}

export function sameOriginRequest(requestUrl: string, originHeader: string | null) {
  if (!originHeader) return false;
  try {
    return new URL(originHeader).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}
