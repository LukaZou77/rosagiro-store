"use client";

import { readCart, writeCart } from "@/components/CartCount";

export function AddToCartButton({
  slug,
  label = "Adicionar",
  wide = false
}: {
  slug: string;
  label?: string;
  wide?: boolean;
}) {
  return (
    <button
      className={wide ? "button primary wide" : undefined}
      type="button"
      onClick={() => {
        const cart = readCart();
        const existing = cart.find((item) => item.slug === slug);
        if (existing) existing.quantity += 1;
        else cart.push({ slug, quantity: 1 });
        writeCart(cart);
      }}
    >
      {label}
    </button>
  );
}
