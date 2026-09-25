import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

type ProductFixture = ReturnType<typeof orderableProduct>;

type PaymentMethod = "PIX" | "CREDIT_CARD" | "SIMULATED";

type OrderCreateData = {
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
  payment: { create: { method: PaymentMethod; amountCents: number } };
};

type PreferenceBody = {
  items: Array<{ unit_price: number; description?: string }>;
  metadata: { payment_method_requested: string };
  payment_methods: { installments: number };
};

type PersistedOrder = {
  id: string;
  orderNumber: string;
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

const prisma = {
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
          providerPreferenceId: null,
          providerInitPoint: null,
          providerSandboxInitPoint: null
        }
      };
      return { id: persistedOrder.id, orderNumber: persistedOrder.orderNumber, customerName: data.customerName, totalCents: data.totalCents };
    },
    findUnique: async () => persistedOrder
  },
  payment: {
    update: async (input: Record<string, unknown>) => {
      paymentUpdates.push(input);
      return input;
    }
  }
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
const retiredShippingRouteModule = await import("../app/api/shipping/quote/route");

const { createOrder, OrderError, parseCheckoutPayload } = ordersModule;
const { startOrderPayment } = mercadoPagoModule;
const { separateFreightForOrder, separateFreightNotice } = freightPolicyModule;
const { POST: postOrder } = orderRouteModule;

const originalEnv = {
  PAYMENT_MODE: process.env.PAYMENT_MODE,
  MERCADO_PAGO_ACCESS_TOKEN: process.env.MERCADO_PAGO_ACCESS_TOKEN,
  MERCADO_PAGO_WEBHOOK_SECRET: process.env.MERCADO_PAGO_WEBHOOK_SECRET,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL
};
const originalFetch = globalThis.fetch;

function checkoutPayload(paymentMethod: "PIX" | "CREDIT_CARD" = "CREDIT_CARD") {
  return {
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

beforeEach(() => {
  process.env.PAYMENT_MODE = "mercado_pago_live";
  process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST_ONLY_ACCESS_TOKEN";
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = "TEST_ONLY_WEBHOOK_SECRET";
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";
  products = [orderableProduct()];
  persistedOrder = null;
  capturedOrderData = null;
  capturedPreferenceBodies = [];
  paymentUpdates = [];
  orderCreateCalls = 0;
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
  const parsed = parseCheckoutPayload(checkoutPayload());
  const tampered = { ...parsed, freightSeparateAccepted: false as unknown as true };

  await assert.rejects(createOrder(tampered), /frete será combinado e pago separadamente/i);
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

  await assert.rejects(createOrder(parseCheckoutPayload(payload)), /pedido mínimo.*R\$\s*500,00/i);
  assert.equal(orderCreateCalls, 0);
});

test("createOrder rejects a quantity that is not a complete wholesale package", async () => {
  const payload = checkoutPayload();
  payload.items[0].quantity = 199;

  await assert.rejects(createOrder(parseCheckoutPayload(payload)), /embalagem fechada com 200 unidades/i);
  assert.equal(orderCreateCalls, 0);
});

test("createOrder rejects insufficient stock", async () => {
  products = [orderableProduct({ inventory: { quantity: 199 } })];

  await assert.rejects(createOrder(parseCheckoutPayload(checkoutPayload())), /não tem estoque suficiente/i);
  assert.equal(orderCreateCalls, 0);
});

test("PIX creates and redirects a new order using product total only", async () => {
  const input = parseCheckoutPayload(checkoutPayload("PIX"));
  const order = await createOrder(input);
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

test("CREDIT_CARD succeeds end-to-end through the real orders route with product total only", async () => {
  const request = new Request("https://example.test/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(checkoutPayload("CREDIT_CARD"))
  });

  const response = await postOrder(request);
  const body = await response.json() as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.equal(body.orderNumber, "RG-TEST-1");
  assert.equal(body.paymentProvider, "MERCADO_PAGO");
  assert.equal(body.externalRedirect, true);
  assert.match(String(body.redirectTo), /TEST-PREFERENCE-1/);
  assert.equal(capturedOrderData?.shippingCents, 0);
  assert.equal(capturedOrderData?.totalCents, 50_000);
  assert.equal(capturedPreferenceBodies[0].items[0].unit_price, 500);
  assert.equal(capturedPreferenceBodies[0].metadata.payment_method_requested, "CREDIT_CARD");
});

test("legacy orders retain their stored freight and total in Mercado Pago", async () => {
  persistedOrder = {
    id: "legacy-order-1",
    orderNumber: "RG-LEGACY-1",
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
