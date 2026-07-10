"use client";

import { useEffect } from "react";
import { trackCommerceOnce, trackGoogleAdsConversion } from "@/lib/commerce-analytics";
import { GOOGLE_ADS_PURCHASE_CONVERSION_SEND_TO } from "@/lib/google-ads";

type OrderConversionTrackerProps = {
  orderNumber: string;
  totalCents: number;
  items: Array<{ productSlug: string; productName: string; productBrand: string; productSkuName: string | null; unitPriceCents: number; quantity: number }>;
};

export function OrderConversionTracker({ orderNumber, totalCents, items }: OrderConversionTrackerProps) {
  useEffect(() => {
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
    if (trackCommerceOnce(`purchase:${orderNumber}`, "purchase", payload)) {
      trackGoogleAdsConversion(GOOGLE_ADS_PURCHASE_CONVERSION_SEND_TO, payload);
    }
  }, [items, orderNumber, totalCents]);
  return null;
}
