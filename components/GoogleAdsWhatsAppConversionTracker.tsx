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
import {
  prepareWhatsAppInquiryHref,
  WHATSAPP_CLICK_ANALYTICS_EVENT,
  whatsAppAnalyticsDestination,
  whatsAppInternalTrackingPath
} from "@/lib/whatsapp-inquiry";

function sendWhatsAppConversion(eventLabel: string) {
  return trackGoogleAdsConversion(GOOGLE_ADS_WHATSAPP_CONVERSION_SEND_TO, {
    event_category: "WhatsApp",
    event_label: eventLabel
  });
}

function recordInternalWhatsAppClick(eventId: string, inquiryReference: string, path: string) {
  const body = JSON.stringify({
    eventId,
    inquiryReference,
    anonymousId: getAnalyticsVisitorId(),
    sessionId: getAnalyticsSessionId(),
    path,
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
    function handleWhatsAppActivation(event: MouseEvent) {
      if (event.type === "auxclick" && event.button !== 1) return;
      if (!(event.target instanceof Element)) return;

      const link = event.target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (!isWhatsAppTrackingHref(link.href)) return;
      if (analyticsPrivacySignalEnabled()) return;
      const trackingPath = whatsAppInternalTrackingPath(window.location.pathname);
      if (!trackingPath) return;

      const prepared = prepareWhatsAppInquiryHref(link.href, makeAnalyticsId());
      if (!prepared) return;
      link.href = prepared.href;

      const destination = whatsAppAnalyticsDestination(prepared.href);
      if (!destination) return;

      recordInternalWhatsAppClick(prepared.eventId, prepared.inquiryReference, trackingPath);
      const key = `whatsapp:${trackingPath}:${destination.label}`;
      trackCommerceOnce(key, WHATSAPP_CLICK_ANALYTICS_EVENT, {
        lead_source: "whatsapp",
        link_url: destination.linkUrl,
        transport_type: "beacon"
      });
      try {
        if (sessionStorage.getItem(`rosagiro:ads-conversion:${key}`)) return;
      } catch {
        // Fall through when storage is unavailable.
      }
      if (sendWhatsAppConversion(destination.label)) {
        try { sessionStorage.setItem(`rosagiro:ads-conversion:${key}`, "1"); } catch { /* Storage is optional. */ }
      }
    }

    document.addEventListener("click", handleWhatsAppActivation, { capture: true });
    document.addEventListener("auxclick", handleWhatsAppActivation, { capture: true });
    return () => {
      document.removeEventListener("click", handleWhatsAppActivation, { capture: true });
      document.removeEventListener("auxclick", handleWhatsAppActivation, { capture: true });
    };
  }, []);

  return null;
}
