"use client";

import { useMemo, useState } from "react";
import { notifyQuickPurchaseOpen, readCart, sameCartLine, writeCart } from "@/components/CartCount";
import { useCustomerSession } from "@/components/CustomerSession";
import { money } from "@/lib/money";

const PRODUCT_IMAGE_SELECT_EVENT = "rosagiro:select-product-image";

type ProductSkuSelectorProps = {
  productSlug: string;
  skus: Array<{
    id: string;
    name: string;
    code: string;
    image?: string | null;
    priceCents: number;
    quantity: number;
  }>;
};

export function ProductSkuSelector({ productSlug, skus }: ProductSkuSelectorProps) {
  const { requireCustomerSession } = useCustomerSession();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const selectedTotal = useMemo(
    () => skus.reduce((total, sku) => total + Math.max(0, quantities[sku.id] || 0), 0),
    [quantities, skus]
  );

  function updateQuantity(skuId: string, nextQuantity: number) {
    const sku = skus.find((item) => item.id === skuId);
    if (!sku) return;
    selectSkuImage(sku.image);
    const safeQuantity = Math.max(0, Math.min(sku.quantity, Math.floor(nextQuantity || 0)));
    setQuantities((current) => ({ ...current, [skuId]: safeQuantity }));
  }

  function selectSkuImage(image?: string | null) {
    if (!image || typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(PRODUCT_IMAGE_SELECT_EVENT, { detail: { image } }));
  }

  function addSelectedSkus() {
    const selected = skus
      .map((sku) => ({ sku, quantity: Math.max(0, quantities[sku.id] || 0) }))
      .filter((item) => item.quantity > 0);

    if (!selected.length) {
      setMessage("Escolha pelo menos uma variação para adicionar.");
      return;
    }

    const cart = readCart();
    for (const item of selected) {
      const existing = cart.find((line) => sameCartLine(line, productSlug, item.sku.id));
      if (existing) existing.quantity = Math.min(existing.quantity + item.quantity, item.sku.quantity);
      else cart.push({ slug: productSlug, skuId: item.sku.id, quantity: item.quantity });
    }

    writeCart(cart);
    notifyQuickPurchaseOpen();
    setMessage(`${selectedTotal} item(ns) adicionados ao pedido.`);
    setQuantities({});
  }

  return (
    <section className="sku-selector" aria-labelledby="sku-selector-title">
      <div className="sku-selector-heading">
        <span aria-hidden="true" />
        <strong id="sku-selector-title">Escolha as variações</strong>
      </div>
      <div className="sku-list">
        {skus.map((sku) => {
          const currentQuantity = quantities[sku.id] || 0;
          const unavailable = sku.quantity <= 0;

          return (
            <div
              className={unavailable ? "sku-row is-unavailable" : "sku-row"}
              key={sku.id}
              onClick={() => selectSkuImage(sku.image)}
            >
              <div className="sku-row-info">
                <strong>{sku.name}</strong>
                <small>#{sku.code}</small>
                <small>{money(sku.priceCents)}</small>
              </div>
              <div className="sku-qty-control">
                <button
                  aria-label={`Diminuir ${sku.name}`}
                  disabled={currentQuantity <= 0 || unavailable}
                  onClick={() => updateQuantity(sku.id, currentQuantity - 1)}
                  type="button"
                >
                  -
                </button>
                <input
                  aria-label={`Quantidade de ${sku.name}`}
                  disabled={unavailable}
                  inputMode="numeric"
                  min="0"
                  max={sku.quantity}
                  onChange={(event) => updateQuantity(sku.id, Number(event.target.value))}
                  type="number"
                  value={currentQuantity}
                />
                <button
                  aria-label={`Aumentar ${sku.name}`}
                  disabled={unavailable || currentQuantity >= sku.quantity}
                  onClick={() => updateQuantity(sku.id, currentQuantity + 1)}
                  type="button"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <button
        className="button primary wide"
        disabled={selectedTotal <= 0}
        onClick={() => {
          if (requireCustomerSession({ intent: "add_to_cart", onSuccess: addSelectedSkus })) addSelectedSkus();
        }}
        type="button"
      >
        Adicionar ao carrinho
      </button>
      {message ? <p className="sku-selector-message" aria-live="polite">{message}</p> : null}
    </section>
  );
}
