"use client";

import { useEffect, useRef, useState } from "react";
import { notifyQuickPurchaseOpen, readCart, sameCartLine, writeCart } from "@/components/CartCount";
import { useCustomerSession } from "@/components/CustomerSession";
import { trackProductEvent } from "@/components/ProductAnalyticsTracker";
import { addWholesalePackageQuantity } from "@/lib/wholesale-order";

export function AddToCartButton({
  slug,
  quantity,
  stockQuantity,
  label = "Adicionar",
  confirmationLabel = "Adicionado",
  unavailableLabel = "Sem estoque",
  wide = false,
  disabled = false,
  analyticsItem
}: {
  slug: string;
  quantity: number;
  stockQuantity: number;
  label?: string;
  confirmationLabel?: string;
  unavailableLabel?: string;
  wide?: boolean;
  disabled?: boolean;
  analyticsItem?: { name?: string; brand?: string; category?: string; priceCents?: number };
}) {
  const { requireCustomerSession } = useCustomerSession();
  const [feedback, setFeedback] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function addItem() {
    const cart = readCart();
    const existing = cart.find((item) => sameCartLine(item, slug));
    const currentQuantity = existing?.quantity ?? 0;
    const nextQuantity = addWholesalePackageQuantity(currentQuantity, quantity, stockQuantity);
    if (nextQuantity > currentQuantity) {
      if (existing) existing.quantity = nextQuantity;
      else cart.push({ slug, quantity: nextQuantity });
      writeCart(cart);
      trackProductEvent({ type: "ADD_TO_CART", slug, skuId: null, quantity: nextQuantity - currentQuantity, item: analyticsItem });
    }
    setFeedback(nextQuantity > currentQuantity ? confirmationLabel : "Limite disponível no pedido");
    notifyQuickPurchaseOpen();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setFeedback(""), 1300);
  }

  return (
    <button
      aria-live="polite"
      className={wide ? "button primary wide" : undefined}
      disabled={disabled}
      type="button"
      onClick={(event) => {
        if (disabled) return;
        if (requireCustomerSession({ intent: "add_to_cart", onSuccess: addItem, trigger: event.currentTarget })) addItem();
      }}
    >
      {disabled ? unavailableLabel : feedback || label}
    </button>
  );
}
