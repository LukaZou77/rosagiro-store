"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  purchaseStatusPollDelay,
  shouldPollPurchaseConfirmation
} from "@/lib/purchase-analytics";

type OrderConversionTrackerProps = {
  orderNumber: string;
  orderStatus: string;
  paymentConfirmed: boolean;
  totalCents: number;
  items: Array<{ productSlug: string; productName: string; productBrand: string; productSkuName: string | null; unitPriceCents: number; quantity: number }>;
};

export function OrderConversionTracker({ orderStatus, paymentConfirmed }: OrderConversionTrackerProps) {
  const router = useRouter();

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
