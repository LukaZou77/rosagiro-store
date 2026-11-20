import assert from "node:assert/strict";
import test from "node:test";
import {
  cartAfterCheckout,
  getCheckoutRecovery,
  saveCheckoutRecovery,
  submitCheckoutAttempt,
  type CheckoutAttempt
} from "./checkout-attempt-client";

const attempt: CheckoutAttempt = {
  checkoutAttemptId: "6beaf47b-3603-4d0c-91be-b9387cc059a6",
  items: [{ slug: "produto-teste", quantity: 12 }],
  customer: { name: "Pessoa Teste", email: "checkout@example.test", phone: "11999999999", cpf: "12345678909" },
  address: { cep: "01001000", state: "SP", city: "São Paulo", district: "Sé", street: "Praça da Sé", number: "1" },
  paymentMethod: "PIX",
  freightSeparateAccepted: true
};
const order = {
  orderNumber: "RG-TESTE-1001",
  redirectTo: "/pedido/RG-TESTE-1001",
  externalRedirect: false,
  paymentPending: false
};

test("unknown outcomes preserve the same attempt and body for the next request", async (t) => {
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/api/orders");
    assert.equal(options.method, "POST");
    requests.push(String(options.body));
    switch (requests.length) {
      case 1: throw new TypeError("network error");
      case 2: return new Response("<html>Gateway timeout</html>", { status: 504 });
      case 3: return Response.json({ error: "Unavailable" }, { status: 500 });
      case 4: return new Response("<html>Offline</html>");
      default: return Response.json({ ...order, orderCreated: true });
    }
  });

  for (let i = 0; i < 4; i++) assert.deepEqual(await submitCheckoutAttempt(attempt), { status: "unknown" });
  assert.deepEqual(await submitCheckoutAttempt(attempt), { status: "confirmed", order, message: undefined });
  assert.equal(requests.length, 5);
  for (const request of requests) assert.deepEqual(JSON.parse(request), attempt);
});

test("the timeout aborts a stalled response body and leaves the order outcome unknown", async (t) => {
  let signal: AbortSignal | null | undefined;
  t.mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    signal = options.signal;
    return {
      ok: true,
      status: 200,
      json: () => new Promise((_, reject) => signal?.addEventListener("abort", () => reject(signal?.reason), { once: true }))
    };
  });

  assert.deepEqual(await submitCheckoutAttempt(attempt, 10), { status: "unknown" });
  assert.equal(signal?.aborted, true);
});

test("only explicit pre-creation errors release the attempt and conflicts keep it protected", async (t) => {
  const responses = [
    Response.json({ error: "CPF deve ter 11 dígitos.", orderCreated: false }, { status: 400 }),
    Response.json({ error: "Fora de estoque." }, { status: 400 }),
    Response.json({ error: "Conflito" }, { status: 409 }),
    Response.json({ error: "Indisponível.", orderCreated: false }, { status: 503 }),
    Response.json({ error: "Falhou.", orderCreated: false }, { status: 500 })
  ];
  t.mock.method(globalThis, "fetch", async () => responses.shift());

  assert.deepEqual(await submitCheckoutAttempt(attempt), { status: "rejected", message: "CPF deve ter 11 dígitos." });
  assert.deepEqual(await submitCheckoutAttempt(attempt), { status: "unknown" });
  assert.deepEqual(await submitCheckoutAttempt(attempt), { status: "conflict" });
  assert.deepEqual(await submitCheckoutAttempt(attempt), { status: "rejected", message: "Indisponível." });
  assert.deepEqual(await submitCheckoutAttempt(attempt), { status: "unknown" });
});

test("a saved order with payment pending remains available through its order page", async (t) => {
  const pending = { ...order, paymentPending: true };
  t.mock.method(globalThis, "fetch", async () => Response.json({ ...pending, orderCreated: true, error: "Seu pedido foi salvo." }, { status: 202 }));

  assert.deepEqual(await submitCheckoutAttempt(attempt), {
    status: "confirmed",
    order: pending,
    message: "Seu pedido foi salvo."
  });
});

test("confirmation requires an order number and a matching safe navigation target", async (t) => {
  const unsafe = [
    { ...order, orderNumber: undefined },
    { ...order, redirectTo: "/pedido/RG-OUTRO-1001" },
    { ...order, redirectTo: "//evil.example/path" },
    { ...order, redirectTo: "https://mercadopago.com.br.evil.example/checkout", externalRedirect: true },
    { ...order, redirectTo: "http://www.mercadopago.com.br/checkout", externalRedirect: true },
    { ...order, redirectTo: "https://www.mercadopago.com.br@evil.example/checkout", externalRedirect: true }
  ];
  const mercadoPago = {
    ...order,
    redirectTo: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=TEST",
    externalRedirect: true
  };
  const mercadoPagoGlobal = { ...mercadoPago, redirectTo: "https://www.mercadopago.com/mla/checkout/start?pref_id=TEST" };
  const responses = [...unsafe, mercadoPago, mercadoPagoGlobal].map((body) => Response.json({ ...body, orderCreated: true }));
  t.mock.method(globalThis, "fetch", async () => responses.shift());

  for (let i = 0; i < unsafe.length; i++) assert.deepEqual(await submitCheckoutAttempt(attempt), { status: "unknown" });
  assert.deepEqual(await submitCheckoutAttempt(attempt), { status: "confirmed", order: mercadoPago, message: undefined });
  assert.deepEqual(await submitCheckoutAttempt(attempt), { status: "confirmed", order: mercadoPagoGlobal, message: undefined });
});

test("tab recovery can reload a snapshot, drops contact data on confirmation and falls back to memory", (t) => {
  const entries = new Map<string, string>();
  let blockWrites = false;
  const sessionStorage = {
    getItem: (key: string) => entries.get(key) || null,
    setItem: (key: string, value: string) => {
      if (blockWrites) throw new Error("Storage unavailable");
      entries.set(key, value);
    },
    removeItem: (key: string) => entries.delete(key)
  };
  const browser = Object.defineProperty(globalThis, "window", { configurable: true, value: { sessionStorage } });
  t.after(() => {
    blockWrites = false;
    saveCheckoutRecovery(null);
    Reflect.deleteProperty(browser, "window");
  });

  entries.set("rosagiro:checkout-recovery:v1", JSON.stringify({ status: "pending", attempt }));
  const restored = getCheckoutRecovery();
  assert.equal(restored.persisted, true);
  assert.equal(restored.recovery?.status, "pending");
  assert.deepEqual(restored.recovery?.attempt, attempt);

  entries.set("rosagiro:checkout-recovery:v1", JSON.stringify({ status: "pending", attempt: { ...attempt, items: [null] } }));
  assert.deepEqual(getCheckoutRecovery().recovery, { status: "unreadable" });

  saveCheckoutRecovery({ status: "confirmed", order });
  const savedConfirmation = entries.get("rosagiro:checkout-recovery:v1") || "";
  assert.match(savedConfirmation, /RG-TESTE-1001/);
  assert.doesNotMatch(savedConfirmation, /checkout@example.test|12345678909|Praça da Sé/);

  blockWrites = true;
  saveCheckoutRecovery({ status: "pending", attempt });
  assert.deepEqual(getCheckoutRecovery(), { ready: true, persisted: false, recovery: { status: "pending", attempt } });
  saveCheckoutRecovery({ status: "confirmed", order });
  assert.equal(entries.size, 0);
  assert.deepEqual(getCheckoutRecovery(), { ready: true, persisted: false, recovery: { status: "confirmed", order } });
});

test("confirmation removes ordered lines while preserving cart changes made during checkout", () => {
  assert.deepEqual(cartAfterCheckout(attempt.items, attempt.items), []);
  const aNewCart = [...attempt.items, { slug: "outro-produto", quantity: 24 }];
  assert.deepEqual(cartAfterCheckout(aNewCart, attempt.items), [{ slug: "outro-produto", quantity: 24 }]);
  const changedQuantity = [{ slug: "produto-teste", quantity: 24 }];
  assert.deepEqual(cartAfterCheckout(changedQuantity, attempt.items), changedQuantity);
});
