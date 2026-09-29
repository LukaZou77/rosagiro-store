import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { trackProductEvent } from "./ProductAnalyticsTracker";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("storefront mounts internal statistics without Google tags or the consent popup", () => {
  const layout = source("../app/layout.tsx");
  assert.match(layout, /<SiteAnalyticsTracker\s*\/>/);
  assert.match(layout, /<WhatsAppAnalyticsTracker\s*\/>/);
  assert.doesNotMatch(layout, /AnalyticsConsent|GooglePageViewTracker|googleTagBootstrap|googletagmanager|AttributionTracker/);
});

test("page and WhatsApp tracking retain their first-party endpoints and privacy checks", () => {
  const page = source("./SiteAnalyticsTracker.tsx");
  const whatsapp = source("./WhatsAppAnalyticsTracker.tsx");
  assert.match(page, /\/api\/analytics\/page-views/);
  assert.match(whatsapp, /\/api\/analytics\/whatsapp-clicks/);
  assert.match(whatsapp, /prepareWhatsAppInquiryHref/);
  assert.match(whatsapp, /recordInternalWhatsAppClick\(prepared.eventId/);
  for (const code of [page, whatsapp]) assert.match(code, /analyticsPrivacySignalEnabled/);
  assert.doesNotMatch(whatsapp, /trackCommerceOnce|trackGoogleAdsConversion|sendWhatsAppConversion/);
});

test("order payment status polling remains without Google purchase tracking", () => {
  const code = source("./OrderConversionTracker.tsx");
  assert.match(code, /shouldPollPurchaseConfirmation\(orderStatus, paymentConfirmed\)/);
  assert.match(code, /router\.refresh\(\)/);
  assert.doesNotMatch(code, /trackPurchaseOnce|startPurchaseTrackingLifecycle|GOOGLE_/);
});

for (const useBeacon of [true, false]) {
  test(`product views and cart events still reach the backend (${useBeacon ? "beacon" : "fetch"})`, async (context) => {
    const names = ["window", "navigator", "localStorage", "fetch"];
    const originals = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    context.after(() => {
      for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    });
    const sent: Array<{ url: string; body: string | Blob }> = [];
    const storage = { getItem: () => "test-visitor", setItem: () => undefined };
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: useBeacon ? { sendBeacon: (url: string, body: Blob) => { sent.push({ url, body }); return true; } } : {}
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: (url: string, options: { body: string }) => {
        sent.push({ url, body: options.body });
        return Promise.resolve({ ok: true });
      }
    });
    for (const type of ["PRODUCT_VIEW", "ADD_TO_CART"] as const) {
      trackProductEvent({ type, slug: "test-product", quantity: 2 });
    }
    assert.equal(sent.length, 2);
    for (const [index, event] of sent.entries()) {
      assert.equal(event.url, "/api/analytics/product-events");
      const payload = JSON.parse(typeof event.body === "string" ? event.body : await event.body.text());
      assert.equal(payload.type, index === 0 ? "PRODUCT_VIEW" : "ADD_TO_CART");
      assert.equal(payload.quantity, 2);
      assert.equal(payload.slug, "test-product");
    }
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { globalPrivacyControl: true } });
    trackProductEvent({ type: "PRODUCT_VIEW", slug: "test-product" });
    assert.equal(sent.length, 2, "GPC must still suppress optional internal navigation events");
  });
}
