"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { analyticsPrivacySignalEnabled } from "@/lib/browser-analytics";
import { GA4_MEASUREMENT_ID } from "@/lib/commerce-analytics";
import { analyticsPageContext } from "@/lib/google-tag-bootstrap";
import { getGoogleAnalyticsConsent } from "@/lib/google-analytics-consent";

export function GooglePageViewTracker() {
  const pathname = usePathname();
  const lastPath = useRef("");
  useEffect(() => {
    function trackPage() {
      if (!GA4_MEASUREMENT_ID || analyticsPrivacySignalEnabled() || !getGoogleAnalyticsConsent() || !window.gtag || lastPath.current === pathname) return;
      const context = analyticsPageContext(window.location, document.title, document.referrer);
      if (!context) return;
      window.gtag("event", "page_view", { ...context, send_to: GA4_MEASUREMENT_ID });
      lastPath.current = pathname;
    }
    trackPage();
    window.addEventListener("rosagiro:analytics-ready", trackPage);
    return () => window.removeEventListener("rosagiro:analytics-ready", trackPage);
  }, [pathname]);
  return null;
}
