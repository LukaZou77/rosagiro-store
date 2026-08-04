"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { normalizeWholesaleLineQuantity } from "@/lib/wholesale-order";

const CART_KEY = "bela-viva-cart";
const QUICK_PURCHASE_OPEN_EVENT = "bela-viva-quick-purchase-open";

type CartLine = {
  slug: string;
  quantity: number;
};

export type { CartLine };

export function cartLineKey(line: Pick<CartLine, "slug">) {
  return line.slug;
}

export function sameCartLine(line: Pick<CartLine, "slug">, slug: string) {
  return line.slug === slug;
}

export function normalizeCartLines(input: unknown): CartLine[] {
  if (!Array.isArray(input)) return [];
  const byKey = new Map<string, CartLine>();

  for (const rawLine of input) {
    const candidate = rawLine as Partial<CartLine>;
    const slug = String(candidate.slug || "").trim();
    const quantity = normalizeWholesaleLineQuantity(candidate.quantity);
    if (!slug || quantity <= 0) continue;

    const key = cartLineKey({ slug });
    const existing = byKey.get(key);
    if (existing) existing.quantity = normalizeWholesaleLineQuantity(existing.quantity + quantity);
    else byKey.set(key, { slug, quantity });
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
  const count = cart.length;
  return (
    <Link className="cart-link" href="/carrinho" aria-label="Abrir pedido">
      <span className="cart-icon">Pedido</span>
      <span className="cart-count">{count}</span>
    </Link>
  );
}
