import assert from "node:assert/strict";
import test from "node:test";
import {
  GOOGLE_ANALYTICS_CONSENT_CHANGE_EVENT,
  GOOGLE_ANALYTICS_CONSENT_STORAGE_KEY,
  getGoogleAnalyticsConsent,
  getStoredGoogleAnalyticsConsent,
  persistGoogleAnalyticsConsent
} from "@/lib/google-analytics-consent";

const originalGlobals = new Map(
  ["window", "navigator", "Event"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const)
);

class MemoryStorage {
  values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

class TestEvent {
  constructor(readonly type: string) {}
}

function installBrowser(options: {
  stored?: string;
  dnt?: string;
  gpc?: boolean;
  storageThrows?: boolean;
} = {}) {
  const storage = new MemoryStorage();
  if (options.stored !== undefined) storage.values.set(GOOGLE_ANALYTICS_CONSENT_STORAGE_KEY, options.stored);
  const events: string[] = [];
  const localStorage = options.storageThrows
    ? {
        getItem: () => {
          throw new Error("storage blocked");
        },
        setItem: () => {
          throw new Error("storage blocked");
        }
      }
    : storage;

  Object.defineProperty(globalThis, "Event", { configurable: true, value: TestEvent });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { doNotTrack: options.dnt, globalPrivacyControl: options.gpc }
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage,
      dispatchEvent: (event: TestEvent) => events.push(event.type)
    }
  });
  return { events, storage };
}

function restoreGlobals() {
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
}

test("defaults to no consent and ignores unknown stored values", (context) => {
  context.after(restoreGlobals);
  installBrowser({ stored: "unknown" });
  assert.equal(getStoredGoogleAnalyticsConsent(), null);
  assert.equal(getGoogleAnalyticsConsent(), false);
});

test("persists explicit grant and denial and dispatches the consent event", (context) => {
  context.after(restoreGlobals);
  const browser = installBrowser();

  persistGoogleAnalyticsConsent(true);
  assert.equal(browser.storage.getItem(GOOGLE_ANALYTICS_CONSENT_STORAGE_KEY), "granted");
  assert.equal(getGoogleAnalyticsConsent(), true);

  persistGoogleAnalyticsConsent(false);
  assert.equal(browser.storage.getItem(GOOGLE_ANALYTICS_CONSENT_STORAGE_KEY), "denied");
  assert.equal(getGoogleAnalyticsConsent(), false);
  assert.deepEqual(browser.events, [GOOGLE_ANALYTICS_CONSENT_CHANGE_EVENT, GOOGLE_ANALYTICS_CONSENT_CHANGE_EVENT]);
});

test("DNT and GPC prevent an override even when grant is requested", (context) => {
  context.after(restoreGlobals);
  for (const privacySignal of [{ dnt: "1" }, { dnt: "yes" }, { gpc: true }]) {
    const browser = installBrowser({ stored: "granted", ...privacySignal });
    assert.equal(getGoogleAnalyticsConsent(), false);
    persistGoogleAnalyticsConsent(true);
    assert.equal(browser.storage.getItem(GOOGLE_ANALYTICS_CONSENT_STORAGE_KEY), "denied");
  }
});

test("storage failures fail closed while still notifying listeners", (context) => {
  context.after(restoreGlobals);
  const browser = installBrowser({ storageThrows: true });
  assert.equal(getGoogleAnalyticsConsent(), false);
  persistGoogleAnalyticsConsent(true);
  assert.equal(getGoogleAnalyticsConsent(), false);
  assert.deepEqual(browser.events, [GOOGLE_ANALYTICS_CONSENT_CHANGE_EVENT]);
});
