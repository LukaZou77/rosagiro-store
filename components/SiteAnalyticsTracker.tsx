"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  analyticsPrivacySignalEnabled,
  getAnalyticsSessionId,
  getAnalyticsVisitorId,
  makeAnalyticsId
} from "@/lib/browser-analytics";
import { readAttribution } from "@/lib/commerce-analytics";

const VIEW_KEY_PREFIX = "rosagiro-site-view:";

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
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api") || analyticsPrivacySignalEnabled()) return;
    if (recentlyTracked(pathname)) return;

    const attribution = readAttribution();
    const body = JSON.stringify({
      eventId: makeAnalyticsId(),
      anonymousId: getAnalyticsVisitorId(),
      sessionId: getAnalyticsSessionId(),
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
