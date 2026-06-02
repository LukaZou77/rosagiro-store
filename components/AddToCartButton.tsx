"use client";

import { useEffect, useRef, useState } from "react";
import { notifyQuickPurchaseOpen, readCart, writeCart } from "@/components/CartCount";
import { useCustomerSession } from "@/components/CustomerSession";

export function AddToCartButton({
  slug,
  label = "Adicionar",
  confirmationLabel = "Adicionado",
  unavailableLabel = "Esgotado",
  wide = false,
  disabled = false
}: {
  slug: string;
  label?: string;
  confirmationLabel?: string;
  unavailableLabel?: string;
  wide?: boolean;
  disabled?: boolean;
}) {
  const { requireCustomerSession } = useCustomerSession();
  const [added, setAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function addItem() {
    const cart = readCart();
    const existing = cart.find((item) => item.slug === slug);
    if (existing) existing.quantity += 1;
    else cart.push({ slug, quantity: 1 });
    writeCart(cart);
    notifyQuickPurchaseOpen();
    setAdded(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setAdded(false), 1300);
  }

  return (
    <button
      aria-live="polite"
      className={wide ? "button primary wide" : undefined}
      disabled={disabled}
      type="button"
      onClick={() => {
        if (disabled) return;
        if (requireCustomerSession({ intent: "add_to_cart", onSuccess: addItem })) addItem();
      }}
    >
      {disabled ? unavailableLabel : added ? confirmationLabel : label}
    </button>
  );
}
