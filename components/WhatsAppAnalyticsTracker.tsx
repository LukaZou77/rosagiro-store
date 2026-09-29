"use client";

import { useEffect } from "react";
import {
  analyticsPrivacySignalEnabled,
  getAnalyticsSessionId,
  getAnalyticsVisitorId,
  makeAnalyticsId
} from "@/lib/browser-analytics";
import { readAttribution } from "@/lib/commerce-analytics";
import { isWhatsAppTrackingHref } from "@/lib/google-ads";
import {
  prepareWhatsAppInquiryHref,
  whatsAppAnalyticsDestination,
  whatsAppInternalTrackingPath
} from "@/lib/whatsapp-inquiry";

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

export function WhatsAppAnalyticsTracker() {
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
