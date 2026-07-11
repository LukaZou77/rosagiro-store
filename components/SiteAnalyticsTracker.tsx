"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { readAttribution } from "@/lib/commerce-analytics";

const VISITOR_KEY = "rosagiro-visitor-id";
const SESSION_KEY = "rosagiro-site-session-id";
const VIEW_KEY_PREFIX = "rosagiro-site-view:";

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function storageValue(storage: Storage, key: string) {
  try {
    const existing = storage.getItem(key);
    if (existing) return existing;
    const next = makeId();
    storage.setItem(key, next);
    return next;
  } catch {
    return makeId();
  }
}

function privacySignalEnabled() {
  const navigatorWithGpc = navigator as Navigator & { globalPrivacyControl?: boolean };
  return navigator.doNotTrack === "1" || navigatorWithGpc.globalPrivacyControl === true;
}

function recentlyTracked(path: string) {
  try {
    const key = `${VIEW_KEY_PREFIX}${path}`;
    const previous = Number(sessionStorage.getItem(key) || "0");
    const now = Date.now();
    if (previous && now - previous < 1500) return true;
    sessionStorage.setItem(key, String(now));
  } catch {
    // Storage is optional; server-side event IDs still prevent exact duplicates.
  }
  return false;
}

export function SiteAnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api") || privacySignalEnabled()) return;
    if (recentlyTracked(pathname)) return;

    const attribution = readAttribution();
    const body = JSON.stringify({
      eventId: makeId(),
      anonymousId: storageValue(localStorage, VISITOR_KEY),
      sessionId: storageValue(sessionStorage, SESSION_KEY),
      path: pathname,
      referrer: document.referrer,
      ...attribution
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/analytics/page-views", blob)) return;
    }

    fetch("/api/analytics/page-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin"
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
