import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const testRoot = resolve(import.meta.dirname, "..");
const moduleUrl = (relativePath: string) => pathToFileURL(resolve(testRoot, relativePath)).href;
const secret = "test-session-secret-with-enough-entropy";

let adminAuthenticated = false;
let simulatePaymentCalls = 0;

class TestOrderError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

mock.module(moduleUrl("lib/auth.ts"), {
  exports: {
    getAdmin: async () => (adminAuthenticated ? { id: "admin-1", email: "admin@example.test", name: "Admin" } : null)
  }
});
mock.module(moduleUrl("lib/orders.ts"), {
  exports: {
    OrderError: TestOrderError,
    simulatePayment: async () => {
      simulatePaymentCalls += 1;
    }
  }
});

const core = await import("./order-access-core");
const simulateRoute = await import("../app/api/orders/[orderNumber]/simulate-payment/route");
const exchangeRoute = await import("../app/pedido/acesso/[orderNumber]/route");

beforeEach(() => {
  process.env.SESSION_SECRET = secret;
  adminAuthenticated = false;
  simulatePaymentCalls = 0;
});

function requestFor(orderNumber: string, cookie?: string, origin = "https://example.test") {
  const headers = new Headers({ origin });
  if (cookie) headers.set("cookie", cookie);
  return new Request(`https://example.test/api/orders/${orderNumber}/simulate-payment`, { method: "POST", headers });
}

function orderCookie(orderNumber: string) {
  const name = core.orderAccessCookieName(orderNumber, secret);
  const value = core.createOrderAccessGrant(orderNumber, secret);
  return `${name}=${value}`;
}

test("simulation rejects order-number-only access before payment code runs", async () => {
  const response = await simulateRoute.POST(requestFor("RG-ORDER-1"), { params: Promise.resolve({ orderNumber: "RG-ORDER-1" }) });
  assert.equal(response.status, 403);
  assert.equal(simulatePaymentCalls, 0);
});

test("forged, wrong-order and manual customer identity cookies do not grant simulation", async () => {
  const target = "RG-ORDER-1";
  const valid = orderCookie(target);
  const forged = `${valid.slice(0, -1)}${valid.endsWith("0") ? "1" : "0"}`;
  const attempts = [
    forged,
    orderCookie("RG-ORDER-2"),
    "bela-viva-customer-session=Maria%3A5511999999999; customerId=customer-1; phone=5511999999999"
  ];

  for (const cookie of attempts) {
    const response = await simulateRoute.POST(requestFor(target, cookie), { params: Promise.resolve({ orderNumber: target }) });
    assert.equal(response.status, 403);
  }
  assert.equal(simulatePaymentCalls, 0);
});

test("valid order cookie and real admin session can reach simulation", async () => {
  const orderNumber = "RG-ORDER-1";
  const cookieResponse = await simulateRoute.POST(requestFor(orderNumber, orderCookie(orderNumber)), {
    params: Promise.resolve({ orderNumber })
  });
  assert.equal(cookieResponse.status, 200);
  assert.equal(simulatePaymentCalls, 1);

  adminAuthenticated = true;
  const adminResponse = await simulateRoute.POST(requestFor(orderNumber), { params: Promise.resolve({ orderNumber }) });
  assert.equal(adminResponse.status, 200);
  assert.equal(simulatePaymentCalls, 2);
});

test("simulation rejects a missing or cross-origin Origin before payment code runs", async () => {
  const orderNumber = "RG-ORDER-1";
  const cookie = orderCookie(orderNumber);
  const missingOrigin = new Request(`https://example.test/api/orders/${orderNumber}/simulate-payment`, {
    method: "POST",
    headers: { cookie }
  });
  const missingResponse = await simulateRoute.POST(missingOrigin, { params: Promise.resolve({ orderNumber }) });
  const crossResponse = await simulateRoute.POST(requestFor(orderNumber, cookie, "https://evil.example"), {
    params: Promise.resolve({ orderNumber })
  });
  assert.equal(missingResponse.status, 403);
  assert.equal(crossResponse.status, 403);
  assert.equal(simulatePaymentCalls, 0);
});

test("share exchange sets an HttpOnly capability and redirects to a token-free URL", async () => {
  const orderNumber = "RG-ORDER-1";
  const grant = core.createOrderShareGrant(orderNumber, secret);
  const request = new Request(
    `https://example.test/pedido/acesso/${orderNumber}?grant=${encodeURIComponent(grant)}&mp=success`
  );
  const originalNodeEnv = process.env.NODE_ENV;
  Reflect.set(process.env, "NODE_ENV", "production");
  try {
    const response = await exchangeRoute.GET(request, { params: Promise.resolve({ orderNumber }) });

    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), `https://example.test/pedido/${orderNumber}?mp=success`);
    assert.equal(response.headers.get("location")?.includes("grant"), false);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.match(String(response.headers.get("cache-control")), /no-store/);
    assert.match(String(response.headers.get("set-cookie")), /HttpOnly/i);
    assert.match(String(response.headers.get("set-cookie")), /SameSite=Lax/i);
    assert.match(String(response.headers.get("set-cookie")), /Secure/i);
  } finally {
    if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Reflect.set(process.env, "NODE_ENV", originalNodeEnv);
  }
});

test("invalid share exchange never sets a capability and still removes the token", async () => {
  const orderNumber = "RG-ORDER-1";
  const request = new Request(`https://example.test/pedido/acesso/${orderNumber}?grant=forged`);
  const response = await exchangeRoute.GET(request, { params: Promise.resolve({ orderNumber }) });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), `https://example.test/pedido/${orderNumber}`);
  assert.equal(response.headers.has("set-cookie"), false);
});
