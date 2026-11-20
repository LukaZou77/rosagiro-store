import { mercadoPagoCheckoutUrl } from "@/lib/mercado-pago-checkout-url";
import type { CheckoutInput } from "@/lib/orders";

const recoveryKey = "rosagiro:checkout-recovery:v1";
const attemptIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CheckoutPayload = Pick<CheckoutInput, "items" | "customer" | "address" | "freightSeparateAccepted" | "paymentMethod" | "attribution">;

export type CheckoutAttempt = CheckoutPayload & { checkoutAttemptId: string };

type ConfirmedOrder = {
  orderNumber: string;
  redirectTo: string;
  externalRedirect: boolean;
  paymentPending: boolean;
};

export type CheckoutRecovery =
  | { status: "pending"; attempt: CheckoutAttempt; conflict?: true }
  | { status: "confirmed"; order: ConfirmedOrder }
  | { status: "unreadable" };

type CheckoutResult =
  | { status: "confirmed"; order: ConfirmedOrder; message?: string }
  | { status: "rejected"; message: string }
  | { status: "conflict" }
  | { status: "unknown" };

type RecoverySnapshot = { recovery: CheckoutRecovery | null; persisted: boolean; ready: boolean };

const serverSnapshot: RecoverySnapshot = { recovery: null, persisted: false, ready: false };
const emptySnapshot: RecoverySnapshot = { recovery: null, persisted: true, ready: true };
const storageUnavailable: RecoverySnapshot = { ...emptySnapshot, persisted: false };
const listeners = new Set<() => void>();
let lastStoredValue: string | null = null;
let lastSnapshot = emptySnapshot;
let memorySnapshot: RecoverySnapshot | null = null;

function asRecord(value: unknown) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readConfirmedOrder(value: unknown): ConfirmedOrder | null {
  const data = asRecord(value);
  if (!data) return null;
  const { orderNumber, redirectTo, externalRedirect, paymentPending = false } = data;
  if (
    typeof orderNumber !== "string" || !/^RG-[A-Z0-9-]{1,60}$/.test(orderNumber) ||
    typeof redirectTo !== "string" || typeof externalRedirect !== "boolean" || typeof paymentPending !== "boolean"
  ) return null;

  const orderHref = `/pedido/${orderNumber}`;
  if (paymentPending && (externalRedirect || redirectTo !== orderHref)) return null;
  if (externalRedirect) {
    if (!mercadoPagoCheckoutUrl(redirectTo)) return null;
  } else if (redirectTo !== orderHref && redirectTo !== `/pagamento-simulado/${orderNumber}`) {
    return null;
  }

  return { orderNumber, redirectTo, externalRedirect, paymentPending };
}

function readRecovery(value: string): CheckoutRecovery {
  try {
    const data = asRecord(JSON.parse(value));
    if (data?.status === "confirmed") {
      const order = readConfirmedOrder(data.order);
      if (order) return { status: "confirmed", order };
    }
    if (data?.status === "pending") {
      const attempt = asRecord(data.attempt);
      const customer = asRecord(attempt?.customer);
      const address = asRecord(attempt?.address);
      const attribution = asRecord(attempt?.attribution);
      if (
        attempt && typeof attempt.checkoutAttemptId === "string" && attemptIdPattern.test(attempt.checkoutAttemptId) &&
        Array.isArray(attempt.items) && attempt.items.length > 0 && attempt.items.every((value: unknown) => {
          const item = asRecord(value);
          return typeof item?.slug === "string" && item.slug.trim().length > 0 &&
            typeof item.quantity === "number" && Number.isInteger(item.quantity) && item.quantity > 0;
        }) &&
        customer && [customer.name, customer.email, customer.phone, customer.cpf].every((field) => typeof field === "string") &&
        address && [address.cep, address.state, address.city, address.district, address.street, address.number]
          .every((field) => typeof field === "string") &&
        (address.complement === undefined || typeof address.complement === "string") &&
        attempt.freightSeparateAccepted === true &&
        (attempt.paymentMethod === "PIX" || attempt.paymentMethod === "SIMULATED") &&
        (attempt.attribution === undefined || (attribution && Object.values(attribution).every((field) => typeof field === "string")))
      ) {
        return { status: "pending", attempt: data.attempt as CheckoutAttempt, conflict: data.conflict === true || undefined };
      }
    }
  } catch {
    // Keep a damaged recovery record from being mistaken for permission to send a new order.
  }
  return { status: "unreadable" };
}

export function getServerCheckoutRecovery() {
  return serverSnapshot;
}

export function getCheckoutRecovery(): RecoverySnapshot {
  if (memorySnapshot) return memorySnapshot;
  try {
    const raw = window.sessionStorage.getItem(recoveryKey);
    if (raw !== lastStoredValue) {
      lastStoredValue = raw;
      lastSnapshot = raw === null ? emptySnapshot : { ...emptySnapshot, recovery: readRecovery(raw) };
    }
    return lastSnapshot;
  } catch {
    return lastSnapshot.recovery ? lastSnapshot : storageUnavailable;
  }
}

export function subscribeCheckoutRecovery(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function saveCheckoutRecovery(recovery: CheckoutRecovery | null) {
  const raw = recovery === null ? null : JSON.stringify(recovery);
  try {
    if (raw === null) window.sessionStorage.removeItem(recoveryKey);
    else window.sessionStorage.setItem(recoveryKey, raw);
    lastStoredValue = raw;
    lastSnapshot = { ...emptySnapshot, recovery };
    memorySnapshot = null;
  } catch {
    memorySnapshot = { ...storageUnavailable, recovery };
    if (recovery?.status === "confirmed") {
      // If replacing the snapshot fails, still try to remove the contact and address data.
      try { window.sessionStorage.removeItem(recoveryKey); } catch { /* Storage is unavailable. */ }
      lastStoredValue = null;
      lastSnapshot = emptySnapshot;
    }
  }
  for (const listener of listeners) listener();
}

export async function submitCheckoutAttempt(attempt: CheckoutAttempt, timeoutMs = 20_000): Promise<CheckoutResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attempt),
      signal: controller.signal,
      redirect: "error"
    });
    const data = asRecord(await response.json());
    const message = typeof data?.error === "string" && data.error.trim() ? data.error : undefined;
    if (response.status === 409 && message) return { status: "conflict" };

    if (response.ok && data?.orderCreated === true) {
      const order = readConfirmedOrder(data);
      if (order && order.paymentPending === (response.status === 202)) {
        return { status: "confirmed", order, message: order.paymentPending ? message : undefined };
      }
    }
    const rejectionStatus = (response.status >= 400 && response.status < 500) || response.status === 503;
    if (data?.orderCreated === false && message && rejectionStatus) {
      return { status: "rejected", message };
    }
    return { status: "unknown" };
  } catch {
    return { status: "unknown" };
  } finally {
    clearTimeout(timeout);
  }
}

export function cartAfterCheckout<T extends CheckoutPayload["items"][number]>(cart: T[], ordered: CheckoutPayload["items"]) {
  const quantities = new Map(ordered.map((line) => [line.slug, line.quantity]));
  return cart.filter((line) => quantities.get(line.slug) !== line.quantity);
}
