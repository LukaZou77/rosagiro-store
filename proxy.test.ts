import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, proxy } from "./proxy";

function request(path: string, ua = "Mozilla/5.0", init: NonNullable<ConstructorParameters<typeof NextRequest>[1]> = {}) {
  const headers = new Headers(init.headers);
  headers.set("user-agent", ua);
  headers.set("host", "rosagiro.com.br");
  return new NextRequest(`https://rosagiro.com.br${path}`, { ...init, headers });
}

test("the real Next matcher covers API/admin/robots and excludes framework static assets", () => {
  for (const url of ["/", "/robots.txt", "/api/orders", "/admin/login", "/api/webhooks/mercado-pago"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), true, url);
  }
  for (const url of ["/_next/static/main.js", "/_next/image?url=example", "/favicon.ico", "/icon.svg"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), false, url);
  }
});

test("Google and AI search/user-fetch crawlers can read public pages, sitemap and assets", () => {
  for (const ua of ["Googlebot/2.1", "Bingbot/2.0", "OAI-SearchBot/1.3", "ChatGPT-User/1.0", "Claude-SearchBot/1.0", "Claude-User/1.0", "PerplexityBot/1.0", "Perplexity-User/1.0"]) {
    for (const path of ["/", "/produto/example", "/categoria/maquiagem", "/sitemap.xml", "/robots.txt", "/_next/static/example.js"]) {
      assert.equal(proxy(request(path, ua)).status, 200, `${ua} ${path}`);
    }
  }
});

test("training agents can discover robots but are still blocked from product crawling", () => {
  for (const ua of ["GPTBot/1.0", "ClaudeBot/1.0", "CCBot/2.0", "AhrefsBot/7.0"]) {
    assert.equal(proxy(request("/robots.txt", ua)).status, 200);
    assert.equal(proxy(request("/robots.txt", ua, { method: "HEAD" })).status, 200);
    assert.equal(proxy(request("/produto/example", ua)).status, 403);
  }
});

test("forging a search UA never bypasses scanner or admin origin protection", () => {
  assert.equal(proxy(request("/.env", "Googlebot/2.1")).status, 403);
  assert.equal(proxy(request("/", "Googlebot/2.1 sqlmap/1.0")).status, 403);
  assert.equal(proxy(request("/api/admin/notifications/read", "Googlebot/2.1", {
    method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }
  })).status, 403);
});

test("normal shopping requests and payment webhook reach their own route validation", () => {
  for (const path of ["/", "/carrinho", "/checkout", "/pedido/example"]) {
    assert.equal(proxy(request(path)).status, 200);
  }
  assert.equal(proxy(request("/api/webhooks/mercado-pago", "MercadoPago Webhook", { method: "POST" })).status, 200);
  assert.equal(proxy(request("/api/cart/summary", undefined, { method: "POST", headers: { "content-type": "application/json" } })).status, 200);
});

test("JSON guards and limits still apply to callers claiming to be Googlebot", () => {
  assert.equal(proxy(request("/api/orders", "Googlebot/2.1", { method: "POST" })).status, 415);
  assert.equal(proxy(request("/api/orders", "Googlebot/2.1", { method: "POST", headers: { "content-type": "text/plain; application/json" } })).status, 415);
  assert.equal(proxy(request("/api/orders", "Googlebot/2.1", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" } })).status, 200);
  assert.equal(proxy(request("/api/orders", "Googlebot/2.1", { method: "POST", headers: { "content-type": "application/json", "content-length": "512001" } })).status, 413);
  const init = { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.91" } };
  for (let i = 0; i < 16; i++) assert.equal(proxy(request("/api/orders", "Googlebot/2.1", init)).status, 200);
  const blocked = proxy(request("/api/orders", "Googlebot/2.1", init));
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  assert.equal(blocked.headers.get("cache-control"), "no-store");
});

test("address autocomplete and place-details limits cover their actual POST methods", () => {
  for (const [path, limit] of [["/api/address/autocomplete", 80], ["/api/address/place-details", 50]] as const) {
    const init = { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.92" } };
    for (let i = 0; i < limit; i++) assert.equal(proxy(request(path, undefined, init)).status, 200);
    assert.equal(proxy(request(path, undefined, init)).status, 429);
  }
});

test("missing IP does not create a shared global shopper bucket", () => {
  for (let i = 0; i < 20; i++) {
    assert.equal(proxy(request("/api/orders", undefined, { method: "POST", headers: { "content-type": "application/json" } })).status, 200);
  }
});
