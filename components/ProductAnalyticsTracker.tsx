"use client";

import { useEffect } from "react";
import { commerceItem, trackCommerceEvent } from "@/lib/commerce-analytics";

const VISITOR_KEY = "rosagiro-visitor-id";
const VIEW_KEY_PREFIX = "rosagiro-product-view:";

function makeVisitorId() {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.randomUUID) return cryptoObject.randomUUID().replace(/-/g, "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function storageGet(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function getAnalyticsVisitorId() {
  if (typeof window === "undefined") return "";
  const existing = storageGet(localStorage, VISITOR_KEY);
  if (existing) return existing;
  const next = makeVisitorId();
  storageSet(localStorage, VISITOR_KEY, next);
  return next;
}

export function trackProductEvent(input: {
  type: "PRODUCT_VIEW" | "ADD_TO_CART";
  slug: string;
  skuId?: string | null;
  quantity?: number;
  item?: { name?: string; brand?: string; category?: string; variant?: string; priceCents?: number };
}) {
  if (typeof window === "undefined") return;
  const anonymousId = getAnalyticsVisitorId();
  if (!anonymousId || !input.slug) return;

  const body = JSON.stringify({
    type: input.type,
    slug: input.slug,
    skuId: input.skuId || null,
    quantity: input.quantity || 1,
    anonymousId
  });

  const eventName = input.type === "PRODUCT_VIEW" ? "view_item" : "add_to_cart";
  const item = commerceItem({
    item_id: input.slug,
    item_name: input.item?.name,
    item_brand: input.item?.brand,
    item_category: input.item?.category,
    item_variant: input.item?.variant,
    price: input.item?.priceCents ? input.item.priceCents / 100 : undefined,
    quantity: input.quantity || 1
  });
  trackCommerceEvent(eventName, { currency: "BRL", value: item.price ? item.price * (item.quantity || 1) : undefined, items: [item] });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/api/analytics/product-events", blob)) return;
  }

  fetch("/api/analytics/product-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true
  }).catch(() => {});

}

export function ProductAnalyticsTracker({
  slug,
  item
}: {
  slug: string;
  item?: { name?: string; brand?: string; category?: string; priceCents?: number };
}) {
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const viewKey = `${VIEW_KEY_PREFIX}${slug}:${today}`;
    if (storageGet(sessionStorage, viewKey)) return;
    storageSet(sessionStorage, viewKey, "1");
    trackProductEvent({ type: "PRODUCT_VIEW", slug, item });
  }, [item, slug]);

  return null;
}
