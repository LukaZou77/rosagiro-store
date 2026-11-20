import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.PAYMENT_POSTGRES_TEST_URL;

test("PostgreSQL serializes duplicate approvals, manual reconciliation and provider initialization", {
  skip: !databaseUrl && "Set PAYMENT_POSTGRES_TEST_URL to the isolated checkout test database"
}, async (context) => {
  const testUrl = new URL(databaseUrl!);
  assert.equal(testUrl.protocol, "postgresql:");
  assert.equal(testUrl.hostname, "127.0.0.1");
  assert.equal(testUrl.port, "55480");
  assert.equal(testUrl.pathname, "/rg_checkout_test");
  assert.equal(testUrl.username, "rg_checkout_test");
  assert.equal(testUrl.search, "");
  process.env.DATABASE_URL = databaseUrl;
  process.env.PAYMENT_MODE = "mercado_pago_live";
  process.env.MERCADO_PAGO_ACCESS_TOKEN = "payment-postgres-test-token";
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = "payment-postgres-test-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";

  context.mock.module("next/cache", { exports: { unstable_cache: (fn: unknown) => fn } });
  const { prisma } = await import("@/lib/db");
  const { markOrderPaid } = await import("@/lib/orders");
  const { processMercadoPagoWebhook, startOrderPayment } = await import("@/lib/mercado-pago");
  const [identity] = await prisma.$queryRaw<Array<{ database: string; role: string }>>`
    SELECT current_database() AS database, current_user AS role
  `;
  assert.deepEqual(identity, { database: "rg_checkout_test", role: "rg_checkout_test" });

  const prefix = `rg-payment-test-${randomUUID()}`;
  const productSlug = `${prefix}-product`;
  const paidAt = new Date("2026-11-01T14:00:00Z");
  const providerPaymentId = `${prefix}-payment`;
  const webhookId = `${prefix}-webhook`;
  const ids: string[] = [];

  async function fixture(label: string, status: "PENDING_PAYMENT" | "SHIPPED", method: "PIX" | "SIMULATED") {
    const order = await prisma.order.create({
      data: {
        orderNumber: `${prefix}-${label}`,
        status,
        customerName: "Cliente teste",
        customerEmail: "payment-test@example.test",
        customerPhone: "+5511912345678",
        customerCpf: "00000000000",
        cep: "01001000",
        state: "SP",
        city: "São Paulo",
        district: "Centro",
        street: "Rua de Teste",
        number: "1",
        subtotalCents: 62_870,
        discountCents: 0,
        shippingCents: 0,
        totalCents: 62_870,
        items: {
          create: {
            productSlug,
            productName: "Produto teste",
            productBrand: "Marca teste",
            productImage: "https://example.test/product.png",
            unitPriceCents: 31_435,
            quantity: 2,
            lineTotalCents: 62_870
          }
        },
        payment: { create: { method, amountCents: 62_870 } }
      }
    });
    ids.push(order.id);
    return order;
  }

  try {
    const order = await fixture("callback", "PENDING_PAYMENT", "PIX");
    const webhookFetch = context.mock.method(globalThis, "fetch", async (input: string) => {
      assert.equal(input, `https://api.mercadopago.com/v1/payments/${providerPaymentId}`);
      return new Response(JSON.stringify({
        id: providerPaymentId,
        external_reference: order.orderNumber,
        status: "approved",
        transaction_amount: 628.70,
        date_approved: paidAt.toISOString()
      }));
    });
    const signature = createHmac("sha256", "payment-postgres-test-secret")
      .update(`id:${providerPaymentId};request-id:test-request;ts:123;`).digest("hex");
    const callbacks = await Promise.all(Array.from({ length: 8 }, () =>
      processMercadoPagoWebhook(new Request("https://example.test/api/webhooks/mercado-pago", {
        headers: { "x-request-id": "test-request", "x-signature": `ts=123,v1=${signature}` }
      }), { id: webhookId, type: "payment", data: { id: providerPaymentId } })
    ));
    assert.ok(callbacks.some((result) => result.body.status === "PAID"));
    assert.ok(callbacks.every((result) => result.httpStatus === 200 && ["PAID", "DUPLICATE"].includes(result.body.status)));
    assert.equal(await prisma.paymentWebhookEvent.count({ where: { dedupeKey: `mercado_pago:${webhookId}` } }), 1);

    const confirmed = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payment: true } });
    assert.equal(confirmed.status, "PAID");
    assert.equal(confirmed.payment?.status, "PAID");
    assert.deepEqual(confirmed.payment?.paidAt, paidAt);
    assert.equal(confirmed.payment?.providerPaymentId, providerPaymentId);
    const metric = await prisma.productDailyMetric.findFirstOrThrow({ where: { productSlug } });
    assert.equal(metric.paidOrderCount, 1);
    assert.equal(metric.paidUnits, 2);
    assert.equal(metric.paidRevenueCents, 62_870);
    assert.equal(await prisma.adminNotification.count({ where: { entityId: order.id, notificationType: "ORDER_PAID" } }), 1);

    const shipped = await fixture("manual", "SHIPPED", "SIMULATED");
    const reconciled = await Promise.all(Array.from({ length: 5 }, () => markOrderPaid(shipped.orderNumber, { source: "manual" })));
    assert.ok(reconciled.every((result) =>
      result.status === "SHIPPED" && result.payment?.status === "PAID" && result.payment.providerStatus === "manual_transfer_confirmed"
    ));
    assert.equal(await prisma.adminNotification.count({ where: { entityId: shipped.id, notificationType: "ORDER_PAID" } }), 1);

    webhookFetch.mock.restore();
    const legacyPix = await fixture("gateway-race", "PENDING_PAYMENT", "PIX");
    let markGatewayStarted!: () => void;
    let finishGatewayRequest!: () => void;
    const started = new Promise<void>((resolve) => { markGatewayStarted = resolve; });
    const gatewayCanReturn = new Promise<void>((resolve) => { finishGatewayRequest = resolve; });
    const preferenceFetch = context.mock.method(globalThis, "fetch", async (input: string) => {
      assert.equal(input, "https://api.mercadopago.com/checkout/preferences");
      markGatewayStarted();
      await gatewayCanReturn;
      return new Response(JSON.stringify({
        id: `${prefix}-unused-preference`,
        init_point: "https://example.test/pay"
      }));
    });
    const initializing = startOrderPayment(legacyPix.orderNumber);
    try {
      await Promise.race([started, initializing.then(() => assert.fail("Gateway request did not start"))]);
      await markOrderPaid(legacyPix.orderNumber, { source: "manual" });
    } finally {
      finishGatewayRequest();
    }
    const result = await initializing;
    assert.equal(result.redirectTo, `/pedido/${legacyPix.orderNumber}`);
    assert.equal(result.external, false);
    const settled = await prisma.payment.findUniqueOrThrow({ where: { orderId: legacyPix.id } });
    assert.equal(settled.status, "PAID");
    assert.equal(settled.provider, "SIMULATED");
    assert.equal(settled.providerStatus, "manual_pix_confirmed");
    assert.equal(settled.providerPaymentId, `manual-pix-${legacyPix.orderNumber}`);
    assert.equal(settled.providerPreferenceId, null);
    assert.equal((await startOrderPayment(legacyPix.orderNumber)).external, false);
    assert.equal(preferenceFetch.mock.callCount(), 1);
  } finally {
    await prisma.paymentWebhookEvent.deleteMany({ where: { dedupeKey: `mercado_pago:${webhookId}` } });
    await prisma.adminNotification.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.productDailyMetric.deleteMany({ where: { productSlug } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
