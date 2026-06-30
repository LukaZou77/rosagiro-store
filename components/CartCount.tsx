"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

const CART_KEY = "bela-viva-cart";
const QUICK_PURCHASE_OPEN_EVENT = "bela-viva-quick-purchase-open";

type CartLine = {
  slug: string;
  skuId?: string;
  quantity: number;
};

export type { CartLine };

export function cartLineKey(line: Pick<CartLine, "slug" | "skuId">) {
  return `${line.slug}::${line.skuId || ""}`;
}

export function sameCartLine(line: Pick<CartLine, "slug" | "skuId">, slug: string, skuId?: string | null) {
  return line.slug === slug && (line.skuId || "") === (skuId || "");
}

export function normalizeCartLines(input: unknown): CartLine[] {
  if (!Array.isArray(input)) return [];
  const byKey = new Map<string, CartLine>();

  for (const rawLine of input) {
    const candidate = rawLine as Partial<CartLine>;
    const slug = String(candidate.slug || "").trim();
    const skuId = String(candidate.skuId || "").trim() || undefined;
    const quantity = Math.max(0, Math.min(999, Math.floor(Number(candidate.quantity) || 0)));
    if (!slug || quantity <= 0) continue;

    const key = cartLineKey({ slug, skuId });
    const existing = byKey.get(key);
    if (existing) existing.quantity += quantity;
    else byKey.set(key, { slug, skuId, quantity });
  }

  return Array.from(byKey.values());
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("bela-viva-cart-changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("bela-viva-cart-changed", callback);
  };
}

function getSnapshot() {
  return localStorage.getItem(CART_KEY) || "[]";
}

function getServerSnapshot() {
  return "[]";
}

export function notifyCartChanged() {
  window.dispatchEvent(new Event("bela-viva-cart-changed"));
}

export function notifyQuickPurchaseOpen() {
  window.dispatchEvent(new Event(QUICK_PURCHASE_OPEN_EVENT));
}

export function readCart() {
  try {
    return normalizeCartLines(JSON.parse(localStorage.getItem(CART_KEY) || "[]"));
  } catch {
    return [];
  }
}

export function writeCart(cart: CartLine[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(normalizeCartLines(cart)));
  notifyCartChanged();
}

export function subscribeQuickPurchaseOpen(callback: () => void) {
  window.addEventListener(QUICK_PURCHASE_OPEN_EVENT, callback);
  return () => window.removeEventListener(QUICK_PURCHASE_OPEN_EVENT, callback);
}

export function useCart() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => {
    try {
      return normalizeCartLines(JSON.parse(snapshot));
    } catch {
      return [];
    }
  }, [snapshot]);
}

export function CartCount() {
  const cart = useCart();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <Link className="cart-link" href="/carrinho" aria-label="Abrir carrinho">
      <span className="cart-icon">Sacola</span>
      <span className="cart-count">{count}</span>
    </Link>
  );
}
