import assert from "node:assert/strict";
import test from "node:test";
import { startPurchaseTrackingLifecycle } from "./purchase-tracking-lifecycle";

const CONSENT_EVENT = "rosagiro:consent-change";
const CONSENT_KEY = "rosagiro:google-consent";
const READY_EVENT = "rosagiro:analytics-ready";

class TestTarget extends EventTarget {
  dispatchStorage(key: string, newValue: string | null) {
    const event = new Event("storage") as Event & { key: string; newValue: string | null };
    Object.defineProperties(event, {
      key: { value: key },
      newValue: { value: newValue }
    });
    this.dispatchEvent(event);
  }
}

function timerFixture() {
  let nextId = 1;
  const callbacks = new Map<number, () => void>();
  return {
    setTimer(callback: () => void) {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    clearTimer(timer: unknown) {
      callbacks.delete(Number(timer));
    },
    async drain() {
      while (callbacks.size) {
        const pending = Array.from(callbacks.values());
        callbacks.clear();
        for (const callback of pending) callback();
        await Promise.resolve();
        await Promise.resolve();
      }
    },
    size() {
      return callbacks.size;
    }
  };
}

test("late consent re-arms purchase tracking after the original retry chain is exhausted", async () => {
  const target = new TestTarget();
  const timers = timerFixture();
  let consentGranted = false;
  let calls = 0;
  const stop = startPurchaseTrackingLifecycle({
    target,
    attempt: async () => {
      calls += 1;
      return { pending: !consentGranted };
    },
    retryDelay: (attempt) => (attempt < 2 ? 0 : null),
    consentGranted: () => consentGranted,
    consentChangeEvent: CONSENT_EVENT,
    consentStorageKey: CONSENT_KEY,
    analyticsReadyEvent: READY_EVENT,
    setTimer: (callback) => timers.setTimer(callback),
    clearTimer: (timer) => timers.clearTimer(timer)
  });

  await Promise.resolve();
  await timers.drain();
  assert.equal(calls, 3);
  assert.equal(timers.size(), 0);

  consentGranted = true;
  target.dispatchEvent(new Event(CONSENT_EVENT));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls, 4);
  assert.equal(timers.size(), 0);
  stop();
});

test("only the consent storage key re-arms tracking and revocation cancels retries", async () => {
  const target = new TestTarget();
  const timers = timerFixture();
  let consentGranted = true;
  let calls = 0;
  const stop = startPurchaseTrackingLifecycle({
    target,
    attempt: async () => {
      calls += 1;
      return { pending: true };
    },
    retryDelay: () => 10,
    consentGranted: () => consentGranted,
    consentChangeEvent: CONSENT_EVENT,
    consentStorageKey: CONSENT_KEY,
    analyticsReadyEvent: READY_EVENT,
    setTimer: (callback) => timers.setTimer(callback),
    clearTimer: (timer) => timers.clearTimer(timer)
  });

  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(timers.size(), 1);
  target.dispatchStorage("unrelated", "granted");
  assert.equal(timers.size(), 1);

  consentGranted = false;
  target.dispatchStorage(CONSENT_KEY, "denied");
  assert.equal(timers.size(), 0);
  target.dispatchEvent(new Event(READY_EVENT));
  await Promise.resolve();
  assert.equal(calls, 1);
  stop();
});

test("consent and analytics-ready signals coalesce while an attempt is in flight", async () => {
  const target = new TestTarget();
  const timers = timerFixture();
  let resolveAttempt: ((result: { pending: boolean }) => void) | undefined;
  let calls = 0;
  let bootstrapWakeups = 0;
  target.addEventListener(CONSENT_EVENT, () => {
    bootstrapWakeups += 1;
  });
  const stop = startPurchaseTrackingLifecycle({
    target,
    attempt: () => {
      calls += 1;
      return new Promise((resolve) => {
        resolveAttempt = resolve;
      });
    },
    retryDelay: () => null,
    consentGranted: () => true,
    consentChangeEvent: CONSENT_EVENT,
    consentStorageKey: CONSENT_KEY,
    analyticsReadyEvent: READY_EVENT,
    setTimer: (callback) => timers.setTimer(callback),
    clearTimer: (timer) => timers.clearTimer(timer)
  });

  assert.equal(calls, 1);
  assert.equal(bootstrapWakeups, 1);
  target.dispatchEvent(new Event(CONSENT_EVENT));
  target.dispatchEvent(new Event(READY_EVENT));
  target.dispatchStorage(CONSENT_KEY, "granted");
  assert.equal(calls, 1);

  resolveAttempt?.({ pending: true });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls, 2);
  stop();
});
