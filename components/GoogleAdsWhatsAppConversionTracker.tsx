"use client";

import { useEffect } from "react";
import {
  analyticsPrivacySignalEnabled,
  getAnalyticsSessionId,
  getAnalyticsVisitorId,
  makeAnalyticsId
} from "@/lib/browser-analytics";
import { readAttribution } from "@/lib/commerce-analytics";
import { GOOGLE_ADS_WHATSAPP_CONVERSION_SEND_TO, isWhatsAppTrackingHref } from "@/lib/google-ads";
import { trackCommerceOnce, trackGoogleAdsConversion } from "@/lib/commerce-analytics";

function sendWhatsAppConversion(href: string) {
  trackGoogleAdsConversion(GOOGLE_ADS_WHATSAPP_CONVERSION_SEND_TO, {
    event_category: "WhatsApp",
    event_label: href
  });
}

function recordInternalWhatsAppClick() {
  if (analyticsPrivacySignalEnabled()) return;
  const body = JSON.stringify({
    eventId: makeAnalyticsId(),
    anonymousId: getAnalyticsVisitorId(),
    sessionId: getAnalyticsSessionId(),
    path: window.location.pathname,
    referrer: document.referrer,
    ...readAttribution()
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/api/analytics/whatsapp-clicks", blob)) return;
  }

  fetch("/api/analytics/whatsapp-clicks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin"
  }).catch(() => undefined);
}

export function GoogleAdsWhatsAppConversionTracker() {
  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;

      const link = event.target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (!isWhatsAppTrackingHref(link.href)) return;

      recordInternalWhatsAppClick();
      const key = `whatsapp:${window.location.pathname}:${link.href}`;
      trackCommerceOnce(key, "generate_lead", {
        lead_source: "whatsapp",
        link_url: link.href,
        transport_type: "beacon"
      });
      try {
        if (sessionStorage.getItem(`rosagiro:ads-conversion:${key}`)) return;
        sessionStorage.setItem(`rosagiro:ads-conversion:${key}`, "1");
      } catch {
        // Fall through when storage is unavailable.
      }
      sendWhatsAppConversion(link.href);
    }

    document.addEventListener("click", handleDocumentClick, { capture: true });
    return () => document.removeEventListener("click", handleDocumentClick, { capture: true });
  }, []);

  return null;
}
