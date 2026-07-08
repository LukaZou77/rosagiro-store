"use client";

import { useEffect } from "react";
import { GOOGLE_ADS_WHATSAPP_CONVERSION_SEND_TO, isWhatsAppTrackingHref } from "@/lib/google-ads";

type GoogleAdsConversionPayload = {
  send_to: string;
  event_category: string;
  event_label?: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (command: "event", eventName: "conversion", payload: GoogleAdsConversionPayload) => void;
  }
}

function sendWhatsAppConversion(href: string) {
  const payload: GoogleAdsConversionPayload = {
    send_to: GOOGLE_ADS_WHATSAPP_CONVERSION_SEND_TO,
    event_category: "WhatsApp",
    event_label: href
  };

  if (typeof window.gtag === "function") {
    window.gtag("event", "conversion", payload);
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(["event", "conversion", payload]);
}

export function GoogleAdsWhatsAppConversionTracker() {
  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;

      const link = event.target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (!isWhatsAppTrackingHref(link.href)) return;

      sendWhatsAppConversion(link.href);
    }

    document.addEventListener("click", handleDocumentClick, { capture: true });
    return () => document.removeEventListener("click", handleDocumentClick, { capture: true });
  }, []);

  return null;
}
