const VISITOR_KEY = "rosagiro-visitor-id";
const SESSION_KEY = "rosagiro-site-session-id";

export function makeAnalyticsId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function storageValue(storage: Storage, key: string) {
  try {
    const existing = storage.getItem(key);
    if (existing) return existing;
    const next = makeAnalyticsId();
    storage.setItem(key, next);
    return next;
  } catch {
    return makeAnalyticsId();
  }
}

export function getAnalyticsVisitorId() {
  if (typeof window === "undefined") return "";
  return storageValue(localStorage, VISITOR_KEY);
}

export function getAnalyticsSessionId() {
  if (typeof window === "undefined") return "";
  return storageValue(sessionStorage, SESSION_KEY);
}

export function analyticsPrivacySignalEnabled() {
  if (typeof navigator === "undefined") return true;
  const navigatorWithGpc = navigator as Navigator & { globalPrivacyControl?: boolean };
  return navigator.doNotTrack === "1" || navigatorWithGpc.globalPrivacyControl === true;
}
