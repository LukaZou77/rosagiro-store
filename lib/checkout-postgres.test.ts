import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { after, afterEach, before, beforeEach, describe, mock, test } from "node:test";
import type { Prisma } from "@/src/generated/prisma/client";
import { orderAccessCookieName, verifyOrderAccessGrant } from "./order-access-core";
import { MAX_WHOLESALE_LINE_QUANTITY } from "./wholesale-order";

const checkoutOrigin = "https://checkout.example.test";
const preferenceEndpoint = "https://api.mercadopago.com/checkout/preferences";
const dbTestsEnabled = process.env.RG_RUN_DB_TESTS === "1";

function requireLocalCheckoutDatabase() {
  let database: URL;
  try {
    database = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    throw new Error("Checkout DB tests require the isolated local DATABASE_URL.");
  }
  assert.ok(
    database.protocol === "postgresql:" && database.hostname === "127.0.0.1" &&
    database.port === "55480" && database.pathname === "/rg_checkout_test" &&
    database.username === "rg_checkout_test" && !database.search && !database.hash,
    "Checkout DB tests require 127.0.0.1:55480/rg_checkout_test without connection options."
  );
}

type CheckoutResult = {
  orderNumber?: string;
  orderCreated?: boolean;
  redirectTo?: string;
  externalRedirect?: boolean;
  paymentPending?: boolean;
  error?: string;
};

type Preference = {
  id: string;
  redirect: string;
  item: { unit_price?: number; quantity?: number; currency_id?: string };
  metadata: { freight_charge_mode?: string; payment_method_requested?: string };
  externalReference: string;
};

type ProviderReply = (preference: Preference) => Promise<Response> | Response;
type SavedOrder = Prisma.OrderGetPayload<{ include: { items: true; payment: true } }>;

function successfulPreference({ id, redirect }: Preference) {
  return Response.json({ id, init_point: redirect }, { status: 200 });
}

const checkoutEnvironment = {
  PAYMENT_MODE: "mercado_pago_live",
  MERCADO_PAGO_ACCESS_TOKEN: "checkout-integration-test-token",
  MERCADO_PAGO_WEBHOOK_SECRET: "checkout-integration-test-webhook",
  NEXT_PUBLIC_SITE_URL: checkoutOrigin,
  SESSION_SECRET: "checkout-integration-test-session-secret",
  VERCEL_ENV: "preview",
  VERCEL_TARGET_ENV: "preview",
  ENABLE_SIMULATED_PAYMENTS: "false"
};

describe("checkout API with isolated PostgreSQL", {
  skip: dbTestsEnabled ? false : "Set RG_RUN_DB_TESTS=1 to run against the isolated local database."
}, () => {
  let prisma: typeof import("./db").prisma;
  let postOrder: typeof import("../app/api/orders/route").POST;
  let providerReply: ProviderReply = successfulPreference;
  let preferences: Preference[] = [];
  let unexpectedFetches = 0;
  let addressFailure: boolean;
  const originalFetch = globalThis.fetch;
  const originalEnv = Object.entries(checkoutEnvironment).map(([key]) => [key, process.env[key]] as const);

  before(async () => {
    requireLocalCheckoutDatabase();
    globalThis.fetch = interceptFetch;
    mock.module(new URL("./google-address.ts", import.meta.url).href, {
      exports: {
        validateCheckoutAddress: async () => {
          if (addressFailure) throw new Error("Injected transient address lookup failure.");
          return {
            status: "NOT_CHECKED",
            provider: null,
            formattedAddress: null,
            placeId: null,
            granularity: null,
            latitude: null,
            longitude: null,
            message: null,
            checkedAt: null
          };
        }
      }
    });
    mock.module(new URL("./store-profile.ts", import.meta.url).href, {
      exports: {
        configuredMercadoPagoInstallments: () => 12,
        getStoreProfile: async () => ({ mercadoPagoMaxInstallments: 12 }),
        getPublicPixPaymentAccount: () => null
      }
    });
    ({ prisma } = await import("./db"));
    ({ POST: postOrder } = await import("../app/api/orders/route"));
    assert.equal(unexpectedFetches, 0, "Checkout attempted an outbound request during import.");
  });

  beforeEach(() => {
    Object.assign(process.env, checkoutEnvironment);
    addressFailure = false;
    providerReply = successfulPreference;
    preferences = [];
    unexpectedFetches = 0;
  });

  afterEach(() => {
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    assert.equal(unexpectedFetches, 0, "Checkout attempted an unexpected outbound request.");
  });

  after(async () => {
    try {
      await prisma?.$disconnect();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  const interceptFetch: typeof fetch = async (input, init) => {
    if (String(input) !== preferenceEndpoint || init?.method !== "POST") {
      unexpectedFetches += 1;
      throw new Error("Outbound network is disabled in checkout integration tests.");
    }
    const body = JSON.parse(String(init.body)) as {
      items: Preference["item"][];
      metadata: Preference["metadata"];
      external_reference: string;
    };
    const id = `checkout-test-${randomUUID()}`;
    const preference = {
      id,
      redirect: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${id}`,
      item: body.items[0],
      metadata: body.metadata,
      externalReference: body.external_reference
    };
    preferences.push(preference);
    return providerReply(preference);
  };

  function requestFor(body: string) {
    return new Request(`${checkoutOrigin}/api/orders`, {
      method: "POST",
      headers: { origin: checkoutOrigin, "content-type": "application/json" },
      body
    });
  }

  async function postRaw(body: string) {
    const response = await postOrder(requestFor(body));
    return { status: response.status, cookie: response.headers.get("set-cookie"), body: await response.json() as CheckoutResult };
  }

  const post = (payload: unknown) => postRaw(JSON.stringify(payload));

  function assertGrantedOrder(result: Awaited<ReturnType<typeof post>>) {
    assert.equal(result.body.orderCreated, true);
    assert.ok(result.body.orderNumber, "A persisted order must have an order number.");
    assert.ok(result.cookie, "A persisted order must include an access cookie.");
    const cookieName = orderAccessCookieName(result.body.orderNumber, process.env.SESSION_SECRET);
    const cookieValue = result.cookie.split(";")[0].slice(cookieName.length + 1);
    assert.ok(result.cookie.startsWith(`${cookieName}=`), "The cookie must be scoped to the returned order.");
    assert.equal(verifyOrderAccessGrant(result.body.orderNumber, cookieValue, process.env.SESSION_SECRET), true);
    assert.match(result.cookie, /HttpOnly/i);
    assert.match(result.cookie, /SameSite=Lax/i);
    return result.body.orderNumber;
  }

  function assertPending(result: Awaited<ReturnType<typeof post>>) {
    assert.equal(result.status, 202);
    const orderNumber = assertGrantedOrder(result);
    assert.equal(result.body.redirectTo, `/pedido/${orderNumber}`);
    assert.equal(result.body.externalRedirect, false);
    assert.equal(result.body.paymentPending, true);
    return orderNumber;
  }

  function assertNoAccess(result: Awaited<ReturnType<typeof post>>) {
    assert.equal(result.cookie, null);
    assert.equal(result.body.orderNumber, undefined);
    assert.equal(result.body.redirectTo, undefined);
  }

  function assertConflict(result: Awaited<ReturnType<typeof post>>) {
    assert.equal(result.status, 409);
    assertNoAccess(result);
    assert.equal(result.body.orderCreated, undefined);
  }

  async function withFixture(run: (fixture: {
    productId: string;
    payload: (quantity?: number) => ReturnType<typeof buildPayload>;
    orders: () => Promise<SavedOrder[]>;
  }) => Promise<void>) {
    const prefix = `rg-checkout-test-${randomUUID()}`;
    const productId = `${prefix}-product`;
    const customerEmail = `${prefix}@example.test`;
    const attempts = new Set<string>();
    const phone = `55119${randomInt(10_000_000, 100_000_000)}`;
    assert.equal(await prisma.customer.count({ where: { whatsappDigits: phone } }), 0, "Fixture phone collided with existing data.");

    function readOrders() {
      return prisma.order.findMany({ where: { customerEmail }, include: { items: true, payment: true } });
    }

    try {
      await prisma.product.create({
        data: {
          id: productId,
          slug: prefix,
          name: prefix,
          subcategory: "Teste",
          priceCents: 251,
          baseBoxPriceCents: 50_000,
          baseBoxPieces: 200,
          wholesalePackage: "Embalagem fechada com 200 unidades",
          weightGrams: 10,
          image: "/test/checkout.webp",
          descriptionPt: "Produto sintético para validação do checkout.",
          skinType: "",
          finish: "",
          volume: "",
          rating: 0,
          reviewCount: 0,
          stockStatus: "Em estoque",
          brand: { create: { id: `${prefix}-brand`, slug: prefix, name: prefix, logo: "/test/checkout.webp", origin: "BR", descriptionPt: "" } },
          category: { create: { id: `${prefix}-category`, slug: prefix, label: prefix, note: "" } },
          inventory: { create: { quantity: 1_000 } }
        }
      });
      await run({
        productId,
        payload(quantity = 200) {
          const checkoutAttemptId = randomUUID();
          attempts.add(checkoutAttemptId);
          return buildPayload({ checkoutAttemptId, prefix, customerEmail, phone, quantity });
        },
        orders: readOrders
      });
    } finally {
      const orderIds = (await readOrders()).map(({ id }) => id);
      await prisma.$transaction([
        prisma.adminNotification.deleteMany({ where: { entityType: "ORDER", entityId: { in: orderIds } } }),
        prisma.order.deleteMany({ where: { id: { in: orderIds }, customerEmail } }),
        prisma.checkoutAttempt.deleteMany({ where: { id: { in: [...attempts] } } }),
        prisma.productDailyMetric.deleteMany({ where: { productId } }),
        prisma.product.deleteMany({ where: { id: productId, slug: prefix } }),
        prisma.brand.deleteMany({ where: { id: `${prefix}-brand`, slug: prefix } }),
        prisma.category.deleteMany({ where: { id: `${prefix}-category`, slug: prefix } }),
        prisma.customer.deleteMany({ where: { name: prefix, whatsappDigits: phone } })
      ]);
    }
  }

  function buildPayload({
    checkoutAttemptId, prefix, customerEmail, phone, quantity
  }: { checkoutAttemptId: string; prefix: string; customerEmail: string; phone: string; quantity: number }) {
    return {
      checkoutAttemptId,
      items: [{ slug: prefix, quantity }],
      customer: { name: prefix, email: customerEmail, phone, cpf: "28001238938" },
      address: {
        cep: "01001000",
        state: "SP",
        city: "Cidade Teste",
        district: "Bairro Teste",
        street: "Rua Teste",
        number: "1",
        complement: ""
      },
      freightSeparateAccepted: true,
      paymentMethod: "PIX"
    };
  }

  test("eight concurrent submissions create one order, notification, metric increment and provider preference", async () => {
    await withFixture(async ({ productId, payload, orders }) => {
      const request = payload();
      providerReply = async (preference) => {
        await delay(30);
        return successfulPreference(preference);
      };
      const results = await Promise.all(Array.from({ length: 8 }, () => post(request)));
      const saved = await orders();
      assert.equal(saved.length, 1);
      const order = saved[0];
      for (const result of results) {
        assert.ok(result.status === 200 || result.status === 202, `Unexpected concurrent checkout status ${result.status}.`);
        assert.equal(assertGrantedOrder(result), order.orderNumber);
        if (result.status === 202) assertPending(result);
        else {
          assert.equal(result.body.externalRedirect, true);
          assert.equal(result.body.redirectTo, preferences[0]?.redirect);
        }
      }
      assert.ok(results.some(({ status }) => status === 200), "The provider claim winner must return the saved redirect.");
      assert.equal(order.checkoutAttemptId, request.checkoutAttemptId);
      assert.equal(order.status, "PENDING_PAYMENT");
      assert.equal(order.subtotalCents, 50_000);
      assert.equal(order.totalCents, 50_000);
      assert.equal(order.shippingCents, 0);
      assert.equal(order.shippingMethod, "PADRAO");
      assert.equal(order.shippingQuoteStatus, "SEPARATE_PAYMENT");
      const freight = order.shippingQuoteSnapshot as Record<string, unknown>;
      assert.equal(freight.customerAccepted, true);
      assert.equal(freight.chargeMode, "OUTSIDE_WEBSITE");
      assert.equal(freight.freightAmountCents, null);
      assert.equal(freight.collectedOnWebsiteCents, 0);
      assert.equal(order.items.length, 1);
      assert.equal(order.items[0].quantity, 200);
      assert.equal(order.items[0].packagePieces, 200);
      assert.equal(order.items[0].packageCount, 1);
      assert.equal(order.items[0].packagePriceCents, 50_000);
      assert.equal(order.items[0].unitPriceCents, 250);
      assert.equal(order.items[0].lineTotalCents, 50_000);
      assert.equal(order.payment?.amountCents, 50_000);
      assert.equal(order.payment?.status, "PENDING");
      assert.ok(order.payment?.initializationStartedAt);
      assert.equal(preferences.length, 1);
      assert.equal(order.payment.providerPreferenceId, preferences[0].id);
      assert.equal(preferences[0].item.unit_price, 500);
      assert.equal(preferences[0].item.quantity, 1);
      assert.equal(preferences[0].item.currency_id, "BRL");
      assert.equal(preferences[0].metadata.freight_charge_mode, "OUTSIDE_WEBSITE");
      assert.equal(preferences[0].metadata.payment_method_requested, "PIX");
      assert.equal(preferences[0].externalReference, order.orderNumber);
      assert.equal(await prisma.adminNotification.count({
        where: { entityType: "ORDER", entityId: order.id, notificationType: "NEW_ORDER" }
      }), 1);
      assert.deepEqual(await prisma.productDailyMetric.findMany({
        where: { productId }, select: { orderCount: true, orderedUnits: true }
      }), [{ orderCount: 1, orderedUnits: 200 }]);
      assert.equal(await prisma.inventory.findUnique({ where: { productId } }).then((stock) => stock?.quantity), 1_000);
      const attempt = await prisma.checkoutAttempt.findUniqueOrThrow({ where: { id: request.checkoutAttemptId } });
      assert.equal(attempt.status, "CREATED");
      assert.equal(attempt.requestHash, order.checkoutRequestHash);
    });
  });

  test("a lost client response can be replayed after inventory changes, with the same saved preference", async () => {
    await withFixture(async ({ productId, payload, orders }) => {
      const request = payload();
      // Simulate a client that never receives the successful response.
      assert.equal((await postOrder(requestFor(JSON.stringify(request)))).status, 200);
      const [first] = await orders();
      assert.ok(first);
      await prisma.inventory.update({ where: { productId }, data: { quantity: 0 } });
      const replay = await post(request);
      assert.equal(replay.status, 200);
      assert.equal(assertGrantedOrder(replay), first.orderNumber);
      assert.equal(replay.body.redirectTo, preferences[0]?.redirect);
      assert.equal(preferences.length, 1);
      assert.equal((await orders()).length, 1);
    });
  });

  test("changing a submitted attempt payload responds 409 without order access", async () => {
    await withFixture(async ({ payload, orders }) => {
      const request = payload();
      const first = await post(request);
      assert.equal(first.status, 200);
      const orderNumber = assertGrantedOrder(first);
      const changed = await post({ ...request, items: [{ ...request.items[0], quantity: 400 }] });
      assertConflict(changed);
      assert.equal(JSON.stringify(changed.body).includes(orderNumber), false);
      assert.equal((await orders()).length, 1);
      assert.equal(preferences.length, 1);
    });
  });

  test("switching gateway modes never creates a second preference for an existing order", async () => {
    await withFixture(async ({ payload, orders }) => {
      const request = payload();
      process.env.PAYMENT_MODE = "mercado_pago_sandbox";
      providerReply = ({ id, redirect }) => Response.json({ id, sandbox_init_point: redirect });
      const initial = await post(request);
      assert.equal(initial.status, 200);
      const orderNumber = assertGrantedOrder(initial);
      assert.equal(initial.body.externalRedirect, true);
      assert.equal(initial.body.redirectTo, preferences[0]?.redirect);
      const [first] = await orders();
      assert.equal(first.payment?.providerPreferenceId, preferences[0]?.id);
      assert.equal(first.payment?.providerInitPoint, null);
      assert.equal(first.payment?.providerSandboxInitPoint, initial.body.redirectTo);
      process.env.PAYMENT_MODE = "mercado_pago_live";
      providerReply = successfulPreference;

      const retries = await Promise.all(Array.from({ length: 4 }, () => post(request)));
      for (const retry of retries) assert.equal(assertPending(retry), orderNumber);
      assert.equal((await orders()).length, 1);
      assert.equal(preferences.length, 1);
    });
  });

  test("a live preference in flight blocks manual confirmation and cannot change a canceled order", async () => {
    await withFixture(async ({ payload, orders }) => {
      const { markOrderPaid } = await import("./orders");
      let notifyStarted = () => {};
      let releaseProvider = () => {};
      const providerStarted = new Promise<void>((resolve) => { notifyStarted = resolve; });
      const providerReleased = new Promise<void>((resolve) => { releaseProvider = resolve; });
      providerReply = async (preference) => {
        notifyStarted();
        await providerReleased;
        return successfulPreference(preference);
      };
      const checkout = post(payload());
      let originalOrder: SavedOrder;
      try {
        await Promise.race([
          providerStarted,
          checkout.then(() => assert.fail("Checkout returned before contacting the preference provider."))
        ]);
        [originalOrder] = await orders();
        assert.ok(originalOrder);
        assert.equal(originalOrder.payment?.provider, "MERCADO_PAGO");
        assert.equal(originalOrder.payment.providerPreferenceId, null);
        await assert.rejects(markOrderPaid(originalOrder.orderNumber, { source: "manual" }), { status: 403 });
        await prisma.order.update({ where: { id: originalOrder.id }, data: { status: "CANCELED" } });
      } finally {
        releaseProvider();
        await checkout;
      }

      const result = await checkout;
      assert.ok(result.status === 200 || result.status === 202);
      assert.equal(assertGrantedOrder(result), originalOrder.orderNumber);
      assert.equal(result.body.redirectTo, `/pedido/${originalOrder.orderNumber}`);
      assert.equal(result.body.externalRedirect, false);
      const [canceled] = await orders();
      assert.equal(canceled.status, "CANCELED");
      assert.deepEqual(canceled.payment, originalOrder.payment);
      assert.equal(preferences.length, 1);
    });
  });

  for (const [outcome, reply] of [
    ["times out", () => { throw new DOMException("Provider timeout", "TimeoutError"); }],
    ["returns non-JSON", () => new Response("Invalid upstream body", { status: 200 })]
  ] satisfies Array<[string, ProviderReply]>) {
    test(`a provider that ${outcome} leaves one persisted payment claim and a usable order link`, async () => {
      await withFixture(async ({ payload, orders }) => {
        const request = payload();
        providerReply = reply;
        const orderNumber = assertPending(await post(request));
        const [order] = await orders();
        assert.equal(order.orderNumber, orderNumber);
        assert.equal(order.status, "PENDING_PAYMENT");
        assert.equal(order.payment?.status, "PENDING");
        assert.equal(order.payment?.providerPreferenceId, null);
        assert.ok(order.payment?.initializationStartedAt);
        providerReply = successfulPreference;
        assert.equal(assertPending(await post(request)), orderNumber);
        assert.equal(preferences.length, 1);
        assert.equal((await orders()).length, 1);
      });
    });
  }

  test("an unknown failure omits a no-order guarantee and can be retried under the same ID", async () => {
    await withFixture(async ({ payload, orders }) => {
      const request = payload();
      addressFailure = true;
      const failed = await post(request);
      assert.equal(failed.status, 500);
      assertNoAccess(failed);
      assert.equal(failed.body.orderCreated, undefined);
      assert.equal((await orders()).length, 0);
      assert.equal(preferences.length, 0);
      addressFailure = false;
      const retry = await post(request);
      assert.equal(retry.status, 200);
      assertGrantedOrder(retry);
      assert.equal((await orders()).length, 1);
    });
  });

  async function assertBusinessRejection(request: unknown, message: RegExp) {
    const rejection = await post(request);
    assert.equal(rejection.status, 400);
    assertNoAccess(rejection);
    assert.equal(rejection.body.orderCreated, false);
    assert.match(rejection.body.error ?? "", message);
    return rejection;
  }

  test("the R$500 minimum is terminal for an attempt even after correcting the price", async () => {
    await withFixture(async ({ productId, payload, orders }) => {
      await prisma.product.update({ where: { id: productId }, data: { baseBoxPriceCents: 49_999 } });
      const request = payload();
      const message = /pedido mínimo.*R\$\s*500,00/i;
      const first = await assertBusinessRejection(request, message);
      await prisma.product.update({ where: { id: productId }, data: { baseBoxPriceCents: 50_000 } });
      assert.deepEqual((await assertBusinessRejection(request, message)).body, first.body);
      assert.equal((await orders()).length, 0);
      assert.equal(preferences.length, 0);
      const attempt = await prisma.checkoutAttempt.findUniqueOrThrow({ where: { id: request.checkoutAttemptId } });
      assert.equal(attempt.status, "REJECTED");
      assert.equal(attempt.statusCode, 400);
      assert.equal(attempt.error, first.body.error);
      const corrected = await post(payload());
      assert.equal(corrected.status, 200);
      assertGrantedOrder(corrected);
      assert.equal((await orders()).length, 1);
    });
  });

  test("a partial package is terminal, and a corrected cart requires a fresh attempt", async () => {
    await withFixture(async ({ payload, orders }) => {
      const request = payload(199);
      const message = /embalagem fechada com 200 unidades/i;
      const first = await assertBusinessRejection(request, message);
      assert.deepEqual((await assertBusinessRejection(request, message)).body, first.body);
      assertConflict(await post({ ...request, items: [{ ...request.items[0], quantity: 200 }] }));
      const attempt = await prisma.checkoutAttempt.findUniqueOrThrow({ where: { id: request.checkoutAttemptId } });
      assert.equal(attempt.status, "REJECTED");
      assert.equal((await orders()).length, 0);
      assert.equal(preferences.length, 0);
      const corrected = await post(payload(200));
      assert.equal(corrected.status, 200);
      assertGrantedOrder(corrected);
      assert.equal((await orders()).length, 1);
    });
  });

  test("summary and checkout agree on complete packages above 999 units and preserve the sale terms", async () => {
    await withFixture(async ({ productId, payload, orders }) => {
      await prisma.product.update({ where: { id: productId }, data: { baseBoxPriceCents: 50_001 } });
      const request = payload(1_000);
      const { POST: summarizeCart } = await import("../app/api/cart/summary/route");
      const summaryResponse = await summarizeCart(new Request(`${checkoutOrigin}/api/cart/summary`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: request.items })
      }));
      assert.equal(summaryResponse.status, 200);
      const summary = await summaryResponse.json();
      assert.equal(summary.packageReady, true);
      assert.equal(summary.lines.length, 1);
      assert.equal(summary.lines[0].quantity, 1_000);
      assert.equal(summary.lines[0].stockQuantity, 1_000);
      assert.equal(summary.lines[0].packagePriceCents, 50_001);
      assert.equal(summary.lines[0].priceCents, 250);
      assert.equal(summary.totalCents, 250_005);

      await assertBusinessRejection(payload(1_200), /não tem estoque suficiente/i);
      const result = await post(request);
      assert.equal(result.status, 200);
      assertGrantedOrder(result);
      await prisma.product.update({
        where: { id: productId },
        data: { baseBoxPieces: 100, baseBoxPriceCents: 35_000 }
      });
      const [order] = await orders();
      assert.equal(order.totalCents, summary.totalCents);
      assert.equal(order.payment?.amountCents, summary.totalCents);
      assert.equal(order.items[0].quantity, 1_000);
      assert.equal(order.items[0].packagePieces, 200);
      assert.equal(order.items[0].packageCount, 5);
      assert.equal(order.items[0].packagePriceCents, 50_001);
      assert.equal(order.items[0].unitPriceCents, 250);
      assert.equal(order.items[0].lineTotalCents, summary.totalCents);
      assert.equal((await prisma.inventory.findUnique({ where: { productId } }))?.quantity, 1_000);
    });
  });

  test("malformed and out-of-range cart rows cannot create a partial or rounded order", async () => {
    await withFixture(async ({ productId, payload, orders }) => {
      const invalidRows = [
        { quantity: 200.5 },
        { quantity: MAX_WHOLESALE_LINE_QUANTITY + 1 },
        { quantity: true },
        null
      ];
      for (const invalid of invalidRows) {
        const request = payload();
        const [line] = request.items;
        await assertBusinessRejection({
          ...request,
          items: [line, invalid === null ? null : { ...line, ...invalid }]
        }, /revise os itens do carrinho/i);
      }
      const overflow = payload(MAX_WHOLESALE_LINE_QUANTITY);
      await assertBusinessRejection({
        ...overflow,
        items: [...overflow.items, { ...overflow.items[0], quantity: 1 }]
      }, /quantidade de um produto ultrapassa o limite/i);
      assert.equal((await orders()).length, 0);
      assert.equal(preferences.length, 0);

      const legacy = payload();
      const [line] = legacy.items;
      const valid = await post({ ...legacy, items: [{ ...line, quantity: "200" }] });
      assert.equal(valid.status, 200);
      assertGrantedOrder(valid);
      assert.equal((await orders())[0].items[0].quantity, 200);
      assert.equal((await prisma.inventory.findUnique({ where: { productId } }))?.quantity, 1_000);
    });
  });

  test("restocking cannot convert a rejected attempt into an order", async () => {
    await withFixture(async ({ productId, payload, orders }) => {
      await prisma.inventory.update({ where: { productId }, data: { quantity: 199 } });
      const request = payload();
      const message = /não tem estoque suficiente/i;
      const first = await assertBusinessRejection(request, message);
      await prisma.inventory.update({ where: { productId }, data: { quantity: 1_000 } });
      assert.deepEqual((await assertBusinessRejection(request, message)).body, first.body);
      const attempt = await prisma.checkoutAttempt.findUniqueOrThrow({ where: { id: request.checkoutAttemptId } });
      assert.equal(attempt.status, "REJECTED");
      assert.equal((await orders()).length, 0);
      assert.equal(preferences.length, 0);
      const corrected = await post(payload());
      assert.equal(corrected.status, 200);
      assertGrantedOrder(corrected);
      assert.equal((await orders()).length, 1);
    });
  });

  test("malformed JSON, a missing key, and a non-v4 key cannot create an order", async () => {
    await withFixture(async ({ payload, orders }) => {
      const request = payload();
      const results = [
        await postRaw("{"),
        await post({ ...request, checkoutAttemptId: undefined }),
        await post({ ...request, checkoutAttemptId: "00000000-0000-0000-0000-000000000000" })
      ];
      for (const result of results) {
        assert.equal(result.status, 400);
        assertNoAccess(result);
      }
      assert.equal((await orders()).length, 0);
      assert.equal(preferences.length, 0);
    });
  });

  test("an overlong customer name is a definite validation error and a corrected checkout succeeds", async () => {
    await withFixture(async ({ payload, orders }) => {
      const request = payload();
      await assertBusinessRejection({
        ...request, customer: { ...request.customer, name: "x".repeat(81) }
      }, /80 caracteres/i);
      assert.equal((await orders()).length, 0);
      assert.equal(preferences.length, 0);
      const corrected = await post(payload());
      assert.equal(corrected.status, 200);
      assertGrantedOrder(corrected);
      assert.equal((await orders()).length, 1);
    });
  });

  test("missing provider configuration fails before creating an order or consuming the key", async () => {
    await withFixture(async ({ payload, orders }) => {
      const request = payload();
      delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
      const failure = await post(request);
      assert.equal(failure.status, 503);
      assert.equal(failure.body.orderCreated, undefined);
      assertNoAccess(failure);
      assert.equal((await orders()).length, 0);
      assert.equal(preferences.length, 0);
      assert.equal(await prisma.checkoutAttempt.count({ where: { id: request.checkoutAttemptId } }), 0);
      process.env.MERCADO_PAGO_ACCESS_TOKEN = checkoutEnvironment.MERCADO_PAGO_ACCESS_TOKEN;
      const retry = await post(request);
      assert.equal(retry.status, 200);
      assertGrantedOrder(retry);
    });
  });

  test("manual checkout saves a pending order and opens the protected payment guide without provider calls", async () => {
    await withFixture(async ({ payload, orders }) => {
      process.env.PAYMENT_MODE = "manual";
      const request = payload();
      const result = await post(request);
      assert.equal(result.status, 200);
      const orderNumber = assertGrantedOrder(result);
      assert.equal(result.body.redirectTo, `/pagamento-simulado/${orderNumber}`);
      assert.equal(result.body.externalRedirect, false);
      assert.equal(assertPending(await post(request)), orderNumber);
      const saved = await orders();
      assert.equal(saved.length, 1);
      assert.equal(saved[0].status, "PENDING_PAYMENT");
      assert.equal(saved[0].payment?.status, "PENDING");
      assert.equal(saved[0].payment?.paidAt, null);
      assert.equal(saved[0].payment?.providerPreferenceId, null);
      assert.equal(preferences.length, 0);
    });
  });
});
