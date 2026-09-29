import assert from "node:assert/strict";
import test from "node:test";
import {
  captureAttributionFromLocation,
  readAttribution,
  trackCommerceEvent,
  trackCommerceOnce,
  trackGoogleAdsConversion,
  trackPurchaseOnce
} from "./commerce-analytics";

const globalNames = ["window", "localStorage", "sessionStorage", "navigator"] as const;

for (const consent of [null, "denied", "granted"]) {
  test(`first-party-only policy blocks all Google events with saved consent ${consent}`, async (context) => {
    const originals = new Map(globalNames.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    context.after(() => {
      for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    });
    const values = new Map<string, string>();
    if (consent) values.set("rosagiro:google-consent", consent);
    const writes: string[] = [];
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { writes.push(key); values.set(key, value); }
    };
    const calls: unknown[] = [];
    const dataLayer: unknown[] = [];
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: storage,
        location: { search: "?gclid=test&utm_source=google" },
        gtag: (...args: unknown[]) => calls.push(args),
        dataLayer
      }
    });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });

    captureAttributionFromLocation();
    assert.deepEqual(readAttribution(), {});
    assert.equal(trackCommerceEvent("view_item", { item_id: "test" }), false);
    assert.equal(trackCommerceOnce("checkout", "begin_checkout"), false);
    assert.equal(trackGoogleAdsConversion("AW-test/purchase", { value: 1 }), false);
    assert.deepEqual(await trackPurchaseOnce("RG-TEST", { value: 1 }, {
      ga4MeasurementId: "G-TEST", googleAdsSendTo: "AW-test/purchase"
    }), { ga4: "not_configured", googleAds: "not_configured", pending: false });
    assert.deepEqual(calls, []);
    assert.deepEqual(dataLayer, []);
    assert.deepEqual(writes, []);
  });
}
