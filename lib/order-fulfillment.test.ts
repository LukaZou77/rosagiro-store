import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { beforeEach, mock, test } from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { adminLoginPath, adminReturnPath } from "./admin-login-return";

const moduleUrl = (path: string) => pathToFileURL(resolve(import.meta.dirname, "..", path)).href;
const originalPaidAt = new Date("2026-09-28T12:00:00Z");
let authenticated = true;
let updateCalls = 0;
let paidMetricCalls = 0;
let order = fixture();
function fixture() {
  return {
    id: "order-1", orderNumber: "RG-TEST-1", status: "PAID", totalCents: 62870,
    fulfillmentCarrier: null as string | null, trackingCode: null as string | null,
    shippingCarrier: "Original quote", items: [],
    payment: { status: "PAID", paidAt: originalPaidAt, syncError: null as string | null }
  };
}
const db = {
  order: {
    findUnique: async () => order,
    findUniqueOrThrow: async () => order,
    update: async ({ data }: { data: Record<string, unknown> }) => { updateCalls++; Object.assign(order, data); return order; },
    updateMany: async ({ data }: { data: Record<string, unknown> }) => { Object.assign(order, data); return { count: 1 }; }
  },
  payment: { update: async ({ data }: { data: Record<string, unknown> }) => { Object.assign(order.payment, data); return order.payment; } },
  paymentWebhookEvent: {
    findUnique: async () => null,
    create: async () => ({ id: "event-1" }),
    update: async () => ({ id: "event-1" })
  },
  $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(db)
};
mock.module("next/cache", { exports: { revalidatePath: () => undefined, unstable_cache: (fn: unknown) => fn } });
mock.module("next/navigation", { exports: { redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } } });
mock.module(moduleUrl("lib/auth.ts"), { exports: { requireAdmin: async (returnTo: string) => {
  if (!authenticated) throw new Error(`REDIRECT:${adminLoginPath(returnTo, "session")}`);
  return { id: "admin-1" };
} } });
mock.module(moduleUrl("lib/db.ts"), { exports: { prisma: db } });
mock.module(moduleUrl("lib/product-daily-metrics.ts"), { exports: {
  recordCreatedOrderProductMetrics: async () => undefined,
  recordPaidOrderProductMetrics: async () => { paidMetricCalls++; }
} });
mock.module(moduleUrl("lib/admin-notifications.ts"), { exports: { createOrderNotificationSafely: async () => undefined } });
const { updateOrderStatusAction } = await import("../app/admin/order-actions");
const { markOrderPaid } = await import("./orders");
const { processMercadoPagoWebhook } = await import("./mercado-pago");

beforeEach(() => {
  order = fixture(); authenticated = true; updateCalls = 0; paidMetricCalls = 0;
  mock.restoreAll();
});

function shipmentForm() {
  const form = new FormData();
  form.set("orderNumber", order.orderNumber);
  form.set("status", "SHIPPED");
  form.set("fulfillmentCarrier", "J&T Express");
  form.set("trackingCode", "888100003475169");
  form.set("detail", "1");
  return form;
}

test("shipment state and tracking save together without changing quote or payment", async () => {
  await assert.rejects(updateOrderStatusAction(shipmentForm()), /saved=1/);
  assert.equal(updateCalls, 1);
  assert.equal(order.status, "SHIPPED");
  assert.equal(order.fulfillmentCarrier, "J&T Express");
  assert.equal(order.trackingCode, "888100003475169");
  assert.equal(order.shippingCarrier, "Original quote");
  assert.equal(order.payment.status, "PAID");
  assert.equal(order.totalCents, 62870);
});

test("expired session blocks writes and carries order return path", async () => {
  authenticated = false;
  await assert.rejects(updateOrderStatusAction(shipmentForm()), /admin\/login\?returnTo=.*RG-TEST-1.*error=session/);
  assert.equal(updateCalls, 0);
  assert.equal(order.status, "PAID");
});

test("list status update preserves already-saved tracking", async () => {
  order.fulfillmentCarrier = "J&T Express";
  order.trackingCode = "888100003475169";
  const form = shipmentForm();
  form.delete("fulfillmentCarrier"); form.delete("trackingCode"); form.delete("detail");
  await updateOrderStatusAction(form);
  assert.equal(order.trackingCode, "888100003475169");
});

test("incomplete and overlong shipment details are rejected before writing", async () => {
  for (const bad of ["", "x".repeat(121)]) {
    const form = shipmentForm(); form.set("trackingCode", bad);
    await assert.rejects(updateOrderStatusAction(form), /error=/);
    assert.equal(updateCalls, 0);
  }
});

test("repeated payment confirmation preserves fulfillment and original paidAt", async () => {
  for (const status of ["PAID", "FULFILLING", "SHIPPED"]) {
    order.status = status;
    await markOrderPaid(order.orderNumber, { provider: "MERCADO_PAGO", providerStatus: "approved", paidAt: new Date() });
    assert.equal(order.status, status);
    assert.equal(order.payment.paidAt, originalPaidAt);
    assert.equal(order.payment.syncError, null);
  }
  assert.equal(paidMetricCalls, 0);
});

test("first payment still settles pending orders", async () => {
  order.status = "PENDING_PAYMENT"; order.payment.status = "PENDING";
  await markOrderPaid(order.orderNumber, { provider: "MERCADO_PAGO", providerStatus: "approved" });
  assert.equal(order.status, "PAID");
  assert.equal(order.payment.status, "PAID");
  assert.equal(paidMetricCalls, 1);
});

test("payment callbacks preserve SHIPPED and paid records", async () => {
  process.env.PAYMENT_MODE = "mercado_pago_live";
  process.env.MERCADO_PAGO_ACCESS_TOKEN = "test-only-token";
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = "test-only-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";
  for (const status of ["approved", "rejected", "charged_back"]) {
    order.status = "SHIPPED";
    const fetchMock = mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
      id: "payment-1", external_reference: order.orderNumber, status, transaction_amount: 628.70
    }), { status: 200 }));
    const signature = createHmac("sha256", "test-only-secret").update("id:payment-1;request-id:req-1;ts:123;").digest("hex");
    const request = new Request("https://example.test/api/webhooks/mercado-pago", { headers: {
      "x-request-id": "req-1", "x-signature": `ts=123,v1=${signature}`
    } });
    const result = await processMercadoPagoWebhook(request, { id: status, type: "payment", data: { id: "payment-1" } });
    assert.equal(result.httpStatus, 200);
    assert.notEqual(result.body.status, "SETTLEMENT_FAILED");
    assert.equal(order.status, "SHIPPED");
    assert.equal(order.payment.status, "PAID");
    if (status === "approved") assert.equal(order.payment.syncError, null);
    else assert.match(order.payment.syncError || "", new RegExp(status));
    fetchMock.mock.restore();
  }
});

test("login return targets stay inside the admin area", () => {
  assert.equal(adminReturnPath("/admin/pedidos/RG-TEST-1?saved=1"), "/admin/pedidos/RG-TEST-1?saved=1");
  for (const path of ["//evil.test/admin", "https://evil.test", "/admin/../../outside", "/admin\\evil", "/admin/login", null]) {
    assert.equal(adminReturnPath(path), "/admin");
  }
});
