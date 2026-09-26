import assert from "node:assert/strict";
import test from "node:test";
import { trackPurchaseOnce } from "./commerce-analytics";
import { purchaseDedupeKey } from "./purchase-analytics";

const PURCHASE_LEDGER_KEY = "rosagiro:purchase-events:v2";
const originalGlobals = new Map(
  ["window", "localStorage", "sessionStorage", "navigator"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const)
);

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) || null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function installBrowserGlobals(fakeWindow: object, localStorage = new MemoryStorage(), sessionStorage = new MemoryStorage()) {
  localStorage.setItem("rosagiro:google-consent", "granted");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { ...fakeWindow, localStorage } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: localStorage });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: sessionStorage });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request: async (_name: string, callback: () => unknown) => callback()
      }
    }
  });
  return localStorage;
}

function restoreBrowserGlobals() {
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
}

test("does not track or write a ledger when no purchase destination is configured", async (context) => {
  context.after(restoreBrowserGlobals);
  const calls: unknown[] = [];
  const storage = installBrowserGlobals({ gtag: (...args: unknown[]) => calls.push(args) });
  const payload = { transaction_id: "RG-TEST-1", value: 25, currency: "BRL" };

  assert.deepEqual(await trackPurchaseOnce("RG-TEST-1", payload, {}), {
    ga4: "not_configured",
    googleAds: "not_configured",
    pending: false
  });
  assert.deepEqual(calls, []);
  assert.equal(storage.getItem(PURCHASE_LEDGER_KEY), null);
});

test("waits for installed gtag instead of treating a new dataLayer as ready", async (context) => {
  context.after(restoreBrowserGlobals);
  const dataLayer: unknown[] = [];
  const storage = installBrowserGlobals({ dataLayer });
  const payload = { transaction_id: "RG-TEST-WAIT", value: 25, currency: "BRL" };

  assert.deepEqual(
    await trackPurchaseOnce("RG-TEST-WAIT", payload, {
      ga4MeasurementId: "G-TEST",
      googleAdsSendTo: "AW-test/purchase"
    }),
    { ga4: "not_ready", googleAds: "not_ready", pending: true }
  );
  assert.deepEqual(dataLayer, []);
  assert.equal(storage.getItem(PURCHASE_LEDGER_KEY), null);
});

test("tracks configured GA4 and Ads destinations independently and deduplicates both", async (context) => {
  context.after(restoreBrowserGlobals);
  const calls: unknown[] = [];
  const storage = installBrowserGlobals({
    gtag: (...args: unknown[]) => calls.push(args)
  });
  const payload = { transaction_id: "RG-TEST-SENT", value: 25, currency: "BRL" };
  const destinations = { ga4MeasurementId: "G-TEST", googleAdsSendTo: "AW-test/purchase" };

  assert.deepEqual(await trackPurchaseOnce("RG-TEST-SENT", payload, destinations), {
    ga4: "sent",
    googleAds: "sent",
    pending: false
  });
  assert.deepEqual(await trackPurchaseOnce("RG-TEST-SENT", payload, destinations), {
    ga4: "already_sent",
    googleAds: "already_sent",
    pending: false
  });
  assert.deepEqual(calls, [
    ["event", "purchase", { ...payload, send_to: "G-TEST" }],
    ["event", "conversion", { send_to: "AW-test/purchase", ...payload }]
  ]);
  assert.ok(storage.getItem(PURCHASE_LEDGER_KEY));
});

test("can send Ads without falsely marking an unconfigured GA4 purchase", async (context) => {
  context.after(restoreBrowserGlobals);
  const calls: unknown[] = [];
  const storage = installBrowserGlobals({ gtag: (...args: unknown[]) => calls.push(args) });
  const payload = { transaction_id: "RG-TEST-ADS-ONLY", value: 25, currency: "BRL" };

  assert.deepEqual(
    await trackPurchaseOnce("RG-TEST-ADS-ONLY", payload, { googleAdsSendTo: "AW-test/purchase" }),
    { ga4: "not_configured", googleAds: "sent", pending: false }
  );
  assert.deepEqual(calls, [["event", "conversion", { send_to: "AW-test/purchase", ...payload }]]);
  const ledger = JSON.parse(storage.getItem(PURCHASE_LEDGER_KEY) || "{}") as Record<string, Record<string, unknown>>;
  const entry = ledger[purchaseDedupeKey("RG-TEST-ADS-ONLY")];
  assert.equal("purchaseSentAt" in entry, false);
  assert.equal("googleAdsSentAt" in entry, true);
});

test("does not mark configured destinations when installed gtag throws", async (context) => {
  context.after(restoreBrowserGlobals);
  const storage = installBrowserGlobals({
    gtag: () => {
      throw new Error("analytics unavailable");
    }
  });

  assert.deepEqual(
    await trackPurchaseOnce(
      "RG-TEST-UNAVAILABLE",
      { transaction_id: "RG-TEST-UNAVAILABLE" },
      { ga4MeasurementId: "G-TEST", googleAdsSendTo: "AW-test/purchase" }
    ),
    { ga4: "not_ready", googleAds: "not_ready", pending: true }
  );
  assert.equal(storage.getItem(PURCHASE_LEDGER_KEY), null);
});

test("privacy opt-out prevents purchase tracking and dedupe writes", async (context) => {
  context.after(restoreBrowserGlobals);
  const calls: unknown[] = [];
  const storage = installBrowserGlobals({ gtag: (...args: unknown[]) => calls.push(args) });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { globalPrivacyControl: true } });
  const result = await trackPurchaseOnce("RG-OPT-OUT", { transaction_id: "RG-OPT-OUT" }, { ga4MeasurementId: "G-TEST" });
  assert.equal(result.ga4, "not_ready");
  assert.deepEqual(calls, []);
  assert.equal(storage.getItem(PURCHASE_LEDGER_KEY), null);
});

test("denied consent does not send or mark purchases and later consent permits tracking", async (context) => {
  context.after(restoreBrowserGlobals);
  const calls: unknown[] = [];
  const storage = installBrowserGlobals({ gtag: (...args: unknown[]) => calls.push(args) });
  storage.setItem("rosagiro:google-consent", "denied");
  const payload = { transaction_id: "RG-CONSENT", value: 25, currency: "BRL" };
  const destinations = { ga4MeasurementId: "G-TEST", googleAdsSendTo: "AW-test/purchase" };

  assert.deepEqual(await trackPurchaseOnce("RG-CONSENT", payload, destinations), {
    ga4: "not_ready", googleAds: "not_ready", pending: true
  });
  assert.deepEqual(calls, []);
  assert.equal(storage.getItem(PURCHASE_LEDGER_KEY), null);

  storage.setItem("rosagiro:google-consent", "granted");
  assert.deepEqual(await trackPurchaseOnce("RG-CONSENT", payload, destinations), {
    ga4: "sent", googleAds: "sent", pending: false
  });
  assert.equal(calls.length, 2);
});
