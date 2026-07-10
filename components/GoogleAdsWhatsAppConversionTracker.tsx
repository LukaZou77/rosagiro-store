"use client";

import { useEffect } from "react";
import { GOOGLE_ADS_WHATSAPP_CONVERSION_SEND_TO, isWhatsAppTrackingHref } from "@/lib/google-ads";
import { trackCommerceOnce, trackGoogleAdsConversion } from "@/lib/commerce-analytics";

function sendWhatsAppConversion(href: string) {
  trackGoogleAdsConversion(GOOGLE_ADS_WHATSAPP_CONVERSION_SEND_TO, {
    event_category: "WhatsApp",
    event_label: href
  });
}

export function GoogleAdsWhatsAppConversionTracker() {
  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;

      const link = event.target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (!isWhatsAppTrackingHref(link.href)) return;

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
