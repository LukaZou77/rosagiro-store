import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { simulatedPaymentConfirmedStatus } from "./payments";

const orderId = "order-test";
const paidAt = new Date("2026-11-20T02:30:00Z");
const item = {
  productId: "product-test",
  productSlug: "produto-teste",
  productName: "Produto Teste",
  productBrand: "Marca Teste",
  productImage: "/produto-teste.webp",
  quantity: 12,
  lineTotalCents: 50_000,
  product: { category: { label: "Categoria Teste" } }
};

type Payment = { status: string; paidAt: Date | null; providerStatus: string | null };
type PaidMetricWrite = {
  where: { eventDate_productKey: { eventDate: Date; productKey: string } };
  create: { paidUnits: number; paidOrderCount: number; paidRevenueCents: number };
};
let payment: Payment | null;
const findUnique = mock.fn(async () => ({
  id: orderId,
  createdAt: new Date("2026-11-18T19:05:00Z"),
  payment,
  items: [item]
}));
const upsert = mock.fn(async (query: PaidMetricWrite) => query);
const transaction = mock.fn((queries: Promise<PaidMetricWrite>[]) => Promise.all(queries));

mock.module(new URL("./db.ts", import.meta.url).href, {
  exports: { prisma: { order: { findUnique }, productDailyMetric: { upsert }, $transaction: transaction } }
});
const { recordPaidOrderProductMetrics } = await import("./product-daily-metrics");

test("unconfirmed and explicitly simulated payments do not increment paid product metrics", async () => {
  for (const record of [
    null,
    { status: "PENDING", paidAt, providerStatus: "pending" },
    { status: "PAID", paidAt: null, providerStatus: "approved" },
    { status: "PAID", paidAt, providerStatus: simulatedPaymentConfirmedStatus }
  ]) {
    payment = record;
    await recordPaidOrderProductMetrics(orderId);
  }
  assert.equal(upsert.mock.callCount(), 0);
  assert.equal(transaction.mock.callCount(), 0);
});

test("confirmed Mercado Pago and manual payments both count against their São Paulo payment day", async () => {
  for (const providerStatus of ["approved", "manual_transfer_confirmed"]) {
    payment = { status: "PAID", paidAt, providerStatus };
    await recordPaidOrderProductMetrics(orderId);
  }

  assert.equal(transaction.mock.callCount(), 2);
  assert.equal(upsert.mock.callCount(), 2);
  for (const result of upsert.mock.calls) {
    const [query] = result.arguments;
    assert.deepEqual(query.where.eventDate_productKey, {
      eventDate: new Date("2026-11-19T00:00:00Z"), productKey: item.productId
    });
    assert.equal(query.create.paidUnits, item.quantity);
    assert.equal(query.create.paidOrderCount, 1);
    assert.equal(query.create.paidRevenueCents, item.lineTotalCents);
  }
});
