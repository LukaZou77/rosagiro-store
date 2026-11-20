import assert from "node:assert/strict";
import { resolve } from "node:path";
import { beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createOrderAccessGrant, orderAccessCookieName } from "./order-access-core";

const secret = "checkout-resume-test-session-secret";
const orderNumber = "RG-RESUME-1001";
const trackingUrl = `https://example.test/pedido/${orderNumber}`;
const liveUrl = "https://www.mercadopago.com/mla/checkout/start?pref_id=TEST";
const sandboxUrl = "https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=TEST";
const cookieName = orderAccessCookieName(orderNumber, secret);
const moduleUrl = (path: string) => pathToFileURL(resolve(import.meta.dirname, "..", path)).href;
const context = { params: Promise.resolve({ orderNumber }) };
let order: ReturnType<typeof fixture> | null;
let reads: number;

function fixture() {
  return {
    orderNumber,
    status: "PENDING_PAYMENT",
    customerName: "Cliente Teste",
    totalCents: 62300,
    items: [],
    addressMatchStatus: "NOT_CHECKED",
    shippingQuoteStatus: "SEPARATE_PAYMENT",
    payment: {
      provider: "MERCADO_PAGO",
      status: "PENDING",
      method: "PIX",
      paidAt: null as Date | null,
      providerPreferenceId: "TEST" as string | null,
      providerInitPoint: liveUrl as string | null,
      providerSandboxInitPoint: sandboxUrl as string | null
    }
  };
}

mock.module(moduleUrl("lib/db.ts"), { exports: {
  prisma: { order: { findUnique: async () => { reads++; return order; } } }
} });
mock.module(moduleUrl("lib/auth.ts"), { exports: { getAdmin: async () => null } });
mock.module("next/headers", { exports: {
  cookies: async () => ({
    get: (name: string) => name === cookieName ? { value: createOrderAccessGrant(orderNumber, secret) } : undefined
  })
} });
mock.module(moduleUrl("lib/catalog.ts"), { exports: { getCategories: async () => [] } });
mock.module(moduleUrl("lib/store-profile.ts"), { exports: {
  getStoreProfile: async () => ({ whatsapp: "+5511912345678" }),
  getPublicPixPaymentAccount: () => null,
  pixPaymentAccountFromPayload: () => null
} });
mock.module(moduleUrl("components/StoreShell.tsx"), { exports: {
  StoreShell: ({ children }: { children: ReactNode }) => createElement("main", null, children)
} });
mock.module(moduleUrl("components/OrderConversionTracker.tsx"), { exports: { OrderConversionTracker: () => null } });
mock.module(moduleUrl("components/PixPaymentInfo.tsx"), { exports: { PixPaymentInfo: () => null } });
mock.module(moduleUrl("components/WhatsAppLink.tsx"), { exports: {
  WhatsAppLink: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children)
} });
mock.module("next/link", { exports: {
  default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children)
} });

const { GET } = await import("../app/pedido/[orderNumber]/pagamento/route");
const { default: OrderPage } = await import("../app/pedido/[orderNumber]/page");

beforeEach(() => {
  process.env.SESSION_SECRET = secret;
  process.env.PAYMENT_MODE = "mercado_pago_live";
  order = fixture();
  reads = 0;
});

function request(grantFor?: string) {
  const headers = grantFor ? {
    cookie: `${orderAccessCookieName(grantFor, secret)}=${createOrderAccessGrant(grantFor, secret)}`
  } : undefined;
  return new Request(`${trackingUrl}/pagamento`, { headers });
}

test("resuming a payment requires the matching order grant before reading payment data", async () => {
  for (const grant of [undefined, "RG-DIFFERENT-1001"]) {
    const response = await GET(request(grant), context);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("location"), null);
  }
  assert.equal(reads, 0);
});

test("a pending order resumes only the saved Mercado Pago URL for the active mode", async () => {
  const live = await GET(request(orderNumber), context);
  assert.equal(live.status, 307);
  assert.equal(live.headers.get("location"), liveUrl);
  assert.equal(live.headers.get("cache-control"), "private, no-store");
  assert.equal(live.headers.get("referrer-policy"), "no-referrer");

  Reflect.set(process.env, "NODE_ENV", "test");
  process.env.PAYMENT_MODE = "mercado_pago_sandbox";
  assert.equal((await GET(request(orderNumber), context)).headers.get("location"), sandboxUrl);
  order!.payment.providerSandboxInitPoint = null;
  assert.equal((await GET(request(orderNumber), context)).headers.get("location"), trackingUrl);
  process.env.PAYMENT_MODE = "manual";
  assert.equal((await GET(request(orderNumber), context)).headers.get("location"), trackingUrl);
});

test("a stale resume link is safe after payment, cancellation, or absence of a valid saved URL", async () => {
  const denied = [
    null,
    { ...fixture(), status: "CANCELED" },
    { ...fixture(), status: "FULFILLING" },
    { ...fixture(), payment: { ...fixture().payment, status: "PAID", paidAt: new Date() } },
    ...[
      { providerPreferenceId: null },
      { providerInitPoint: null },
      { providerInitPoint: sandboxUrl },
      { providerInitPoint: "http://www.mercadopago.com.br/checkout" },
      { providerInitPoint: "https://www.mercadopago.com.br.evil.example/checkout" },
      { providerInitPoint: "https://user@www.mercadopago.com.br/checkout" }
    ].map((payment) => ({ ...fixture(), payment: { ...fixture().payment, ...payment } }))
  ];
  for (const state of denied) {
    order = state;
    assert.equal((await GET(request(orderNumber), context)).headers.get("location"), trackingUrl);
  }
  assert.equal(reads, denied.length);
});

test("the order page points to the internal resume route once a preference exists", async () => {
  const html = renderToStaticMarkup(await OrderPage(context));
  assert.match(html, new RegExp(`href="/pedido/${orderNumber}/pagamento"`));
  assert.match(html, /Continuar pagamento no Mercado Pago/);
  assert.ok(!html.includes(liveUrl));
});

test("the pending order page asks support to check the original order before retrying payment", async () => {
  order!.payment.providerPreferenceId = null;
  const html = renderToStaticMarkup(await OrderPage(context));
  assert.match(html, /Conferir pagamento pelo WhatsApp/);
  assert.match(html, /confira se houve cobrança antes de tentar novamente/);
  assert.doesNotMatch(html, /Continuar pagamento no Mercado Pago/);
  const whatsappHref = html.match(/href="(https:\/\/wa\.me\/[^"]+)"/)?.[1];
  assert.ok(whatsappHref);
  const supportMessage = new URL(whatsappHref).searchParams.get("text");
  assert.match(supportMessage || "", new RegExp(orderNumber));
  assert.match(supportMessage || "", /verificar se houve cobrança/);

  order!.payment.providerPreferenceId = "TEST";
  const refreshed = renderToStaticMarkup(await OrderPage(context));
  assert.match(refreshed, /Continuar pagamento no Mercado Pago/);
  assert.doesNotMatch(refreshed, /Conferir pagamento pelo WhatsApp/);
});

test("paid and canceled order pages hide payment actions even with a saved link", async () => {
  order!.payment.status = "PAID";
  order!.payment.paidAt = new Date();
  const paid = renderToStaticMarkup(await OrderPage(context));
  assert.doesNotMatch(paid, /Continuar pagamento no Mercado Pago|Conferir pagamento pelo WhatsApp/);

  order = { ...fixture(), status: "CANCELED" };
  const canceled = renderToStaticMarkup(await OrderPage(context));
  assert.doesNotMatch(canceled, /Continuar pagamento no Mercado Pago|Conferir pagamento pelo WhatsApp/);
});
