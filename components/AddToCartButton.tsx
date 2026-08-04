"use client";

import { useEffect, useRef, useState } from "react";
import { notifyQuickPurchaseOpen, readCart, sameCartLine, writeCart } from "@/components/CartCount";
import { useCustomerSession } from "@/components/CustomerSession";
import { trackProductEvent } from "@/components/ProductAnalyticsTracker";
import { addWholesalePackageQuantity } from "@/lib/wholesale-order";

export function AddToCartButton({
  slug,
  quantity = 1,
  label = "Adicionar",
  confirmationLabel = "Adicionado",
  unavailableLabel = "Sem estoque",
  wide = false,
  disabled = false,
  analyticsItem
}: {
  slug: string;
  quantity?: number;
  label?: string;
  confirmationLabel?: string;
  unavailableLabel?: string;
  wide?: boolean;
  disabled?: boolean;
  analyticsItem?: { name?: string; brand?: string; category?: string; priceCents?: number };
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
    const existing = cart.find((item) => sameCartLine(item, slug));
    const nextQuantity = addWholesalePackageQuantity(existing?.quantity || 0, quantity);
    if (nextQuantity <= 0 || nextQuantity === existing?.quantity) return;
    if (existing) existing.quantity = nextQuantity;
    else cart.push({ slug, quantity: nextQuantity });
    writeCart(cart);
    trackProductEvent({ type: "ADD_TO_CART", slug, skuId: null, quantity, item: analyticsItem });
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
