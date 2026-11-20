import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { checkoutAttemptFromPayload } from "./checkout-attempt";

type ProductFixture = ReturnType<typeof orderableProduct>;

type PaymentMethod = "PIX" | "CREDIT_CARD" | "SIMULATED";
type PaymentProvider = "SIMULATED" | "MERCADO_PAGO";

type OrderCreateData = {
  checkoutAttemptId: string;
  checkoutRequestHash: string;
  totalCents: number;
  subtotalCents: number;
  shippingCents: number;
  shippingMethod: string;
  shippingQuoteStatus: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCpf: string;
  cep: string;
  street: string;
  number: string;
  payment: { create: { method: PaymentMethod; provider: PaymentProvider; amountCents: number } };
};

type PreferenceBody = {
  items: Array<{ unit_price: number; description?: string }>;
  metadata: { payment_method_requested: string };
  payment_methods: { installments: number };
  back_urls: { success: string; pending: string; failure: string };
};

type PersistedOrder = {
  id: string;
  orderNumber: string;
  status: "PENDING_PAYMENT";
  checkoutAttemptId?: string;
  checkoutRequestHash?: string;
  totalCents: number;
  subtotalCents: number;
  shippingCents: number;
  shippingQuoteStatus: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCpf: string;
  cep: string;
  street: string;
  number: string;
  payment: {
    method: PaymentMethod;
    provider: PaymentProvider;
    status: "PENDING";
    initializationStartedAt?: Date | null;
    providerPreferenceId: string | null;
    providerInitPoint: string | null;
    providerSandboxInitPoint: string | null;
  };
};

const testRoot = resolve(import.meta.dirname, "..");
const moduleUrl = (relativePath: string) => pathToFileURL(resolve(testRoot, relativePath)).href;

let products: ProductFixture[] = [];
let persistedOrder: PersistedOrder | null = null;
let capturedOrderData: OrderCreateData | null = null;
let capturedPreferenceBodies: PreferenceBody[] = [];
let paymentUpdates: Array<Record<string, unknown>> = [];
let orderCreateCalls = 0;
type AttemptRow = { id: string; requestHash: string; status: string; error?: string; statusCode?: number };
const attempts = new Map<string, AttemptRow>();

function orderableProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "product-test-1",
    slug: "produto-teste",
    name: "Produto de Teste",
    active: true,
    deletedAt: null,
    priceCents: 250,
    baseBoxPieces: 200,
    baseBoxPriceCents: 50_000,
    wholesalePackage: "Embalagem fechada com 200 unidades",
    descriptionPt: "",
    stockStatus: "Em estoque",
    weightGrams: 10,
    image: "/test/product.webp",
    brand: { name: "Marca Teste" },
    category: { slug: "categoria-teste" },
    inventory: { quantity: 1_000 },
    skus: [],
    ...overrides
  };
}

const transactionClient = {
  $queryRaw: async () => [],
  $executeRaw: async (_sql: TemplateStringsArray, id: string, requestHash: string) => {
    if (!attempts.has(id)) attempts.set(id, { id, requestHash, status: "OPEN" });
  },
  checkoutAttempt: {
    findUnique: async ({ where }: { where: { id: string } }) => attempts.get(where.id) ?? null,
    findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
      const attempt = attempts.get(where.id);
      assert.ok(attempt);
      return attempt;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<AttemptRow> }) => {
      const attempt = attempts.get(where.id);
      assert.ok(attempt);
      Object.assign(attempt, data);
    }
  },
  product: {
    findMany: async () => products
  },
  customer: {
    upsert: async () => ({
      id: "customer-test-1",
      name: "Cliente Teste",
      whatsapp: "+55 11 90000-0000",
      whatsappDigits: "5511900000000"
    })
  },
  order: {
    create: async ({ data }: { data: OrderCreateData }) => {
      orderCreateCalls += 1;
      capturedOrderData = data;
      persistedOrder = {
        id: "order-test-1",
        orderNumber: "RG-TEST-1",
        status: "PENDING_PAYMENT",
        checkoutAttemptId: data.checkoutAttemptId,
        checkoutRequestHash: data.checkoutRequestHash,
        totalCents: data.totalCents,
        subtotalCents: data.subtotalCents,
        shippingCents: data.shippingCents,
        shippingQuoteStatus: data.shippingQuoteStatus,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        customerCpf: data.customerCpf,
        cep: data.cep,
        street: data.street,
        number: data.number,
        payment: {
          method: data.payment.create.method,
          provider: data.payment.create.provider,
          status: "PENDING",
          providerPreferenceId: null,
          providerInitPoint: null,
          providerSandboxInitPoint: null
        }
      };
      return { id: persistedOrder.id, orderNumber: persistedOrder.orderNumber, customerName: data.customerName, totalCents: data.totalCents };
    },
    findUnique: async ({ where }: { where: { checkoutAttemptId?: string; orderNumber?: string } }) => {
      if (where.checkoutAttemptId) return persistedOrder?.checkoutAttemptId === where.checkoutAttemptId ? persistedOrder : null;
      return persistedOrder?.orderNumber === where.orderNumber ? persistedOrder : null;
    },
    findUniqueOrThrow: async () => {
      assert.ok(persistedOrder);
      return persistedOrder;
    }
  },
  payment: {
    updateMany: async ({ data }: { data: { initializationStartedAt: Date } }) => {
      if (!persistedOrder || persistedOrder.payment.initializationStartedAt) return { count: 0 };
      persistedOrder.payment.initializationStartedAt = data.initializationStartedAt;
      return { count: 1 };
    },
    update: async (input: Record<string, unknown>) => {
      paymentUpdates.push(input);
      return input;
    }
  }
};

const prisma = {
  ...transactionClient,
  $transaction: async <T>(work: (tx: typeof transactionClient) => Promise<T>): Promise<T> => work(transactionClient)
};

mock.module(moduleUrl("lib/db.ts"), { exports: { prisma } });
mock.module(moduleUrl("lib/admin-notifications.ts"), {
  exports: { createOrderNotificationSafely: async () => undefined }
});
mock.module(moduleUrl("lib/google-address.ts"), {
  exports: {
    validateCheckoutAddress: async () => ({
      status: "NOT_CHECKED",
      provider: "TEST",
      formattedAddress: null,
      placeId: null,
      granularity: null,
      latitude: null,
      longitude: null,
      message: "Validação isolada no teste",
      checkedAt: new Date("2026-09-25T12:00:00.000Z")
    })
  }
});
mock.module(moduleUrl("lib/product-daily-metrics.ts"), {
  exports: {
    recordCreatedOrderProductMetrics: async () => undefined,
    recordPaidOrderProductMetrics: async () => undefined
  }
});
mock.module(moduleUrl("lib/store-profile.ts"), {
  exports: {
    configuredMercadoPagoInstallments: () => 12,
    getStoreProfile: async () => ({ mercadoPagoMaxInstallments: 12 }),
    getPublicPixPaymentAccount: () => null
  }
});

const ordersModule = await import("./orders");
const mercadoPagoModule = await import("./mercado-pago");
const freightPolicyModule = await import("./freight-policy");
const orderRouteModule = await import("../app/api/orders/route");
const orderAccessCoreModule = await import("./order-access-core");
const retiredShippingRouteModule = await import("../app/api/shipping/quote/route");

const { createOrder, OrderError, parseCheckoutPayload, simulatePayment } = ordersModule;
const { startOrderPayment } = mercadoPagoModule;
const { separateFreightForOrder, separateFreightNotice } = freightPolicyModule;
const { POST: postOrder } = orderRouteModule;

const originalEnv = {
  PAYMENT_MODE: process.env.PAYMENT_MODE,
  MERCADO_PAGO_ACCESS_TOKEN: process.env.MERCADO_PAGO_ACCESS_TOKEN,
  MERCADO_PAGO_WEBHOOK_SECRET: process.env.MERCADO_PAGO_WEBHOOK_SECRET,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET
};
const originalFetch = globalThis.fetch;

function checkoutPayload(paymentMethod: "PIX" | "CREDIT_CARD" = "PIX") {
  return {
    checkoutAttemptId: "00000000-0000-4000-8000-000000000001",
    items: [{ slug: "produto-teste", quantity: 200 }],
    customer: {
      name: "Cliente Teste",
      email: "cliente@example.test",
      phone: "(11) 90000-0000",
      cpf: "111.444.777-35"
    },
    address: {
      cep: "01001-000",
      state: "SP",
      city: "Cidade Teste",
      district: "Bairro Teste",
      street: "Rua Teste",
      number: "1",
      complement: ""
    },
    freightSeparateAccepted: true,
    paymentMethod
  };
}

function createOrderForPayload(payload: ReturnType<typeof checkoutPayload>) {
  return createOrder(parseCheckoutPayload(payload), checkoutAttemptFromPayload(payload));
}

function checkoutRequest(paymentMethod: "PIX" | "CREDIT_CARD" = "PIX") {
  return new Request("https://example.test/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "https://example.test" },
    body: JSON.stringify(checkoutPayload(paymentMethod))
  });
}

beforeEach(() => {
  process.env.PAYMENT_MODE = "mercado_pago_live";
  process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST_ONLY_ACCESS_TOKEN";
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = "TEST_ONLY_WEBHOOK_SECRET";
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";
  process.env.SESSION_SECRET = "TEST_ONLY_SESSION_SECRET";
  products = [orderableProduct()];
  persistedOrder = null;
  capturedOrderData = null;
  capturedPreferenceBodies = [];
  paymentUpdates = [];
  orderCreateCalls = 0;
  attempts.clear();
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.equal(url, "https://api.mercadopago.com/checkout/preferences", `unexpected network target: ${url}`);
    assert.equal(init?.method, "POST");
    capturedPreferenceBodies.push(JSON.parse(String(init?.body || "{}")) as PreferenceBody);
    return new Response(
      JSON.stringify({
        id: "TEST-PREFERENCE-1",
        init_point: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=TEST-PREFERENCE-1"
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  };
});

after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("separate freight policy records zero collected freight without calling it free", () => {
  const acceptedAt = new Date("2026-09-25T12:34:56.000Z");
  const result = separateFreightForOrder(acceptedAt);

  assert.equal(result.method, "PADRAO");
  assert.equal(result.status, "SEPARATE_PAYMENT");
  assert.equal(result.shippingCents, 0);
  assert.equal(result.snapshot.freightAmountCents, null);
  assert.equal(result.snapshot.collectedOnWebsiteCents, 0);
  assert.equal(result.snapshot.customerAccepted, true);
  assert.equal(result.snapshot.acceptedAt, acceptedAt.toISOString());
  assert.match(result.message, /frete não está incluído/i);
});

test("checkout payload rejects absent, false or coerced separate-freight consent", () => {
  for (const freightSeparateAccepted of [undefined, null, false, "true", 1]) {
    const payload = { ...checkoutPayload(), freightSeparateAccepted };
    assert.throws(() => parseCheckoutPayload(payload), (error: unknown) => {
      assert.ok(error instanceof OrderError);
      assert.match(error.message, /frete não está incluído/i);
      return true;
    });
  }
  assert.equal(orderCreateCalls, 0);
});

test("retired quote endpoint explains separate freight without network or orders", async () => {
  const response = await retiredShippingRouteModule.POST();
  const body = await response.json();
  assert.equal(response.status, 410);
  assert.equal(body.status, "SEPARATE_PAYMENT");
  assert.deepEqual(body.options, []);
  assert.match(body.message, /fora do site/);
  assert.equal(orderCreateCalls, 0);
  assert.equal(capturedPreferenceBodies.length, 0);
});

test("createOrder rejects consent removed after payload parsing", async () => {
  const payload = checkoutPayload();
  const parsed = parseCheckoutPayload(payload);
  const tampered = { ...parsed, freightSeparateAccepted: false as unknown as true };

  await assert.rejects(createOrder(tampered, checkoutAttemptFromPayload(payload)), /frete será combinado e pago separadamente/i);
  assert.equal(orderCreateCalls, 0);
});

test("checkout payload rejects an incomplete delivery address", () => {
  const payload = checkoutPayload();
  payload.address.street = "";
  assert.throws(() => parseCheckoutPayload(payload), /Preencha todos os dados de endereço/);
  assert.equal(orderCreateCalls, 0);
});

test("createOrder rejects a wholesale subtotal below R$ 500", async () => {
  products = [orderableProduct({ baseBoxPieces: 100, baseBoxPriceCents: 40_000, priceCents: 400 })];
  const payload = checkoutPayload();
  payload.items[0].quantity = 100;

  await assert.rejects(createOrderForPayload(payload), /pedido mínimo.*R\$\s*500,00/i);
  assert.equal(orderCreateCalls, 0);
});

test("createOrder rejects a quantity that is not a complete wholesale package", async () => {
  const payload = checkoutPayload();
  payload.items[0].quantity = 199;

  await assert.rejects(createOrderForPayload(payload), /embalagem fechada com 200 unidades/i);
  assert.equal(orderCreateCalls, 0);
});

test("createOrder rejects insufficient stock", async () => {
  products = [orderableProduct({ inventory: { quantity: 199 } })];

  await assert.rejects(createOrderForPayload(checkoutPayload()), /não tem estoque suficiente/i);
  assert.equal(orderCreateCalls, 0);
});

test("PIX creates and redirects a new order using product total only", async () => {
  const order = await createOrderForPayload(checkoutPayload("PIX"));
  const payment = await startOrderPayment(order.orderNumber);

  assert.equal(order.totalCents, 50_000);
  assert.equal(capturedOrderData?.subtotalCents, 50_000);
  assert.equal(capturedOrderData?.shippingCents, 0);
  assert.equal(capturedOrderData?.totalCents, 50_000);
  assert.equal(capturedOrderData?.shippingMethod, "PADRAO");
  assert.equal(capturedOrderData?.shippingQuoteStatus, "SEPARATE_PAYMENT");
  assert.equal(capturedOrderData?.payment.create.amountCents, 50_000);
  assert.equal(payment.external, true);
  assert.match(payment.redirectTo, /mercadopago\.com\.br/);
  assert.equal(capturedPreferenceBodies.length, 1);
  assert.equal(capturedPreferenceBodies[0].items[0].unit_price, 500);
  assert.equal(capturedPreferenceBodies[0].items[0].description, separateFreightNotice);
  assert.equal(capturedPreferenceBodies[0].metadata.payment_method_requested, "PIX");
  assert.equal(capturedPreferenceBodies[0].payment_methods.installments, 12);
  assert.equal(paymentUpdates.length, 1);
});

test("PIX succeeds end-to-end through the real orders route with product total only", async () => {
  const response = await postOrder(checkoutRequest());
  const body = await response.json() as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.equal(body.orderNumber, "RG-TEST-1");
  assert.equal(body.orderCreated, true);
  assert.equal(body.paymentProvider, "MERCADO_PAGO");
  assert.equal(body.externalRedirect, true);
  assert.match(String(body.redirectTo), /TEST-PREFERENCE-1/);
  const cookieName = orderAccessCoreModule.orderAccessCookieName("RG-TEST-1", process.env.SESSION_SECRET);
  const setCookie = String(response.headers.get("set-cookie"));
  const cookieValue = new RegExp(`${cookieName}=([^;]+)`).exec(setCookie)?.[1];
  assert.ok(cookieValue);
  assert.equal(orderAccessCoreModule.verifyOrderAccessGrant("RG-TEST-1", cookieValue, process.env.SESSION_SECRET), true);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.equal(capturedOrderData?.shippingCents, 0);
  assert.equal(capturedOrderData?.totalCents, 50_000);
  assert.equal(capturedPreferenceBodies[0].items[0].unit_price, 500);
  assert.equal(capturedPreferenceBodies[0].metadata.payment_method_requested, "PIX");
  assert.deepEqual(capturedPreferenceBodies[0].back_urls, {
    success: "https://example.test/pedido/RG-TEST-1?mp=success",
    pending: "https://example.test/pedido/RG-TEST-1?mp=pending",
    failure: "https://example.test/pedido/RG-TEST-1?mp=failure"
  });
});

test("credit-card checkout is rejected before creating an order or payment preference", async () => {
  const response = await postOrder(checkoutRequest("CREDIT_CARD"));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /forma de pagamento válida/);
  assert.equal(orderCreateCalls, 0);
  assert.equal(capturedPreferenceBodies.length, 0);
});

test("orders route fails closed before creating an order when SESSION_SECRET is missing", async () => {
  delete process.env.SESSION_SECRET;

  const response = await postOrder(checkoutRequest());
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(attempts.size, 0);
  assert.equal(orderCreateCalls, 0);
  assert.equal(capturedPreferenceBodies.length, 0);
});

test("live and sandbox Mercado Pago orders cannot be marked paid through simulation", async () => {
  await assert.rejects(simulatePayment("RG-TEST-1"), (error: unknown) => {
    assert.ok(error instanceof OrderError);
    assert.equal(error.status, 403);
    return true;
  });

  process.env.PAYMENT_MODE = "mercado_pago_sandbox";
  persistedOrder = {
    id: "sandbox-order-1",
    orderNumber: "RG-SANDBOX-1",
    status: "PENDING_PAYMENT",
    subtotalCents: 50_000,
    shippingCents: 0,
    totalCents: 50_000,
    shippingQuoteStatus: "SEPARATE_PAYMENT",
    customerName: "Cliente Sandbox",
    customerEmail: "sandbox@example.test",
    customerPhone: "+55 11 90000-0000",
    customerCpf: "111.444.777-35",
    cep: "01001-000",
    street: "Rua Teste",
    number: "1",
    payment: {
      method: "CREDIT_CARD",
      provider: "MERCADO_PAGO",
      status: "PENDING",
      providerPreferenceId: "TEST-PREFERENCE-1",
      providerInitPoint: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=TEST-PREFERENCE-1",
      providerSandboxInitPoint: null
    }
  };

  await assert.rejects(simulatePayment("RG-SANDBOX-1"), (error: unknown) => {
    assert.ok(error instanceof OrderError);
    assert.equal(error.status, 403);
    return true;
  });
});

test("legacy orders retain their stored freight and total in Mercado Pago", async () => {
  persistedOrder = {
    id: "legacy-order-1",
    orderNumber: "RG-LEGACY-1",
    status: "PENDING_PAYMENT",
    subtotalCents: 50_000,
    shippingCents: 2_500,
    totalCents: 52_500,
    shippingQuoteStatus: "OK",
    customerName: "Cliente Legado",
    customerEmail: "legado@example.test",
    customerPhone: "+55 11 90000-0000",
    customerCpf: "111.444.777-35",
    cep: "01001-000",
    street: "Rua Teste",
    number: "1",
    payment: {
      method: "CREDIT_CARD",
      provider: "SIMULATED",
      status: "PENDING",
      providerPreferenceId: null,
      providerInitPoint: null,
      providerSandboxInitPoint: null
    }
  };

  const payment = await startOrderPayment("RG-LEGACY-1");

  assert.equal(payment.external, true);
  assert.equal(orderCreateCalls, 0);
  assert.equal(persistedOrder.shippingCents, 2_500);
  assert.equal(persistedOrder.totalCents, 52_500);
  assert.equal(capturedPreferenceBodies[0].items[0].unit_price, 525);
  assert.equal("description" in capturedPreferenceBodies[0].items[0], false);
});
