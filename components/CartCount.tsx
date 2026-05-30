"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

const CART_KEY = "bela-viva-cart";

type CartLine = {
  slug: string;
  quantity: number;
};

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

export function readCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]") as CartLine[];
  } catch {
    return [];
  }
}

export function writeCart(cart: CartLine[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  notifyCartChanged();
}

export function useCart() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => {
    try {
      return JSON.parse(snapshot) as CartLine[];
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
      <span className="cart-icon">Bag</span>
      <span className="cart-count">{count}</span>
    </Link>
  );
}
