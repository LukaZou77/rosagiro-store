"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GA4_MEASUREMENT_ID, trackPurchaseOnce } from "@/lib/commerce-analytics";
import {
  GOOGLE_ANALYTICS_CONSENT_CHANGE_EVENT,
  GOOGLE_ANALYTICS_CONSENT_STORAGE_KEY,
  getGoogleAnalyticsConsent
} from "@/lib/google-analytics-consent";
import { GOOGLE_ANALYTICS_READY_EVENT } from "@/lib/google-tag-bootstrap";
import { GOOGLE_ADS_PURCHASE_CONVERSION_SEND_TO } from "@/lib/google-ads";
import {
  isPurchaseQualifiedOrder,
  purchaseStatusPollDelay,
  purchaseTrackingRetryDelay,
  shouldPollPurchaseConfirmation
} from "@/lib/purchase-analytics";
import { startPurchaseTrackingLifecycle } from "@/lib/purchase-tracking-lifecycle";

type OrderConversionTrackerProps = {
  orderNumber: string;
  orderStatus: string;
  paymentConfirmed: boolean;
  totalCents: number;
  items: Array<{ productSlug: string; productName: string; productBrand: string; productSkuName: string | null; unitPriceCents: number; quantity: number }>;
};

export function OrderConversionTracker({ orderNumber, orderStatus, paymentConfirmed, totalCents, items }: OrderConversionTrackerProps) {
  const router = useRouter();

  useEffect(() => {
    if (!isPurchaseQualifiedOrder(orderStatus, paymentConfirmed)) return;
    const payload = {
      transaction_id: orderNumber,
      value: totalCents / 100,
      currency: "BRL",
      items: items.map((item) => ({
        item_id: item.productSlug,
        item_name: item.productName,
        item_brand: item.productBrand,
        item_variant: item.productSkuName || undefined,
        price: item.unitPriceCents / 100,
        quantity: item.quantity
      }))
    };

    return startPurchaseTrackingLifecycle({
      target: window,
      attempt: () => trackPurchaseOnce(orderNumber, payload, {
        ga4MeasurementId: GA4_MEASUREMENT_ID,
        googleAdsSendTo: GOOGLE_ADS_PURCHASE_CONVERSION_SEND_TO
      }),
      retryDelay: purchaseTrackingRetryDelay,
      consentGranted: getGoogleAnalyticsConsent,
      consentChangeEvent: GOOGLE_ANALYTICS_CONSENT_CHANGE_EVENT,
      consentStorageKey: GOOGLE_ANALYTICS_CONSENT_STORAGE_KEY,
      analyticsReadyEvent: GOOGLE_ANALYTICS_READY_EVENT
    });
  }, [items, orderNumber, orderStatus, paymentConfirmed, totalCents]);

  useEffect(() => {
    if (!shouldPollPurchaseConfirmation(orderStatus, paymentConfirmed)) return;

    let attempt = 0;
    let cancelled = false;
    let timeoutId: number | undefined;

    function clearScheduledRefresh() {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      timeoutId = undefined;
    }

    function scheduleRefresh() {
      clearScheduledRefresh();
      if (cancelled || document.visibilityState !== "visible" || navigator.onLine === false) return;
      const delay = purchaseStatusPollDelay(attempt);
      if (delay === null) return;

      timeoutId = window.setTimeout(() => {
        timeoutId = undefined;
        if (cancelled || document.visibilityState !== "visible" || navigator.onLine === false) return;
        attempt += 1;
        router.refresh();
        scheduleRefresh();
      }, delay);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") scheduleRefresh();
      else clearScheduledRefresh();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", scheduleRefresh);
    window.addEventListener("offline", clearScheduledRefresh);
    scheduleRefresh();
    return () => {
      cancelled = true;
      clearScheduledRefresh();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", scheduleRefresh);
      window.removeEventListener("offline", clearScheduledRefresh);
    };
  }, [orderStatus, paymentConfirmed, router]);

  return null;
}
