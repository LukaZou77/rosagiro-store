"use client";

import Link from "next/link";
import { useMemo } from "react";
import { cartLineKey, sameCartLine, useCart, writeCart } from "@/components/CartCount";
import { CartCompletionRecommendations } from "@/components/CartCompletionRecommendations";
import { CustomerCheckoutButton } from "@/components/CustomerSession";
import { MinimumOrderNotice } from "@/components/MinimumOrderNotice";
import { StoreTrustSignals } from "@/components/StoreTrustSignals";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { useWhatsAppPhone } from "@/components/WhatsAppProvider";
import { getCartCompletionRecommendations } from "@/lib/cart-completion";
import { money } from "@/lib/money";
import { effectiveSkuPriceCents } from "@/lib/product-pricing";
import { siteConfig } from "@/lib/site-config";
import { buildCartWhatsAppHref } from "@/lib/whatsapp";

type Product = {
  slug: string;
  name: string;
  image: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  badges: string[];
  active: boolean;
  rating?: number;
  reviewCount?: number;
  subcategory: string;
  brand: { name: string };
  category: { slug: string; label?: string };
  inventory: { quantity: number } | null;
  skus?: Array<{ id: string; name: string; code: string; priceCents: number | null; quantity: number; active: boolean }>;
};

type CartDisplayItem = {
  slug: string;
  skuId?: string;
  quantity: number;
  product: Product;
  sku: NonNullable<Product["skus"]>[number] | null;
};

export function CartClient({ products, trustSignals }: { products: Product[]; trustSignals: string[] }) {
  const cart = useCart();
  const whatsappPhone = useWhatsAppPhone();

  const productMap = useMemo(() => new Map(products.map((product) => [product.slug, product])), [products]);
  const items = useMemo(
    () =>
      cart
        .map((item) => {
          const product = productMap.get(item.slug);
          const sku = item.skuId ? product?.skus?.find((candidate) => candidate.id === item.skuId) || null : null;
          return { ...item, product, sku };
        })
        .filter((item): item is CartDisplayItem => Boolean(item.product)),
    [cart, productMap]
  );
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + effectiveSkuPriceCents(item.product, item.sku) * item.quantity, 0), [items]);
  const discount = subtotal >= 25000 ? Math.round(subtotal * 0.1) : 0;
  const total = subtotal - discount;
  const whatsappItems = useMemo(
    () =>
      items.map((item) => ({
        quantity: item.quantity,
        product: {
          name: item.sku ? `${item.product.name} - ${item.sku.name}` : item.product.name,
          priceCents: effectiveSkuPriceCents(item.product, item.sku),
          brand: item.product.brand
        }
      })),
    [items]
  );
  const whatsappHref = useMemo(() => buildCartWhatsAppHref(whatsappItems, subtotal, whatsappPhone), [whatsappItems, subtotal, whatsappPhone]);
  const recommendations = useMemo(
    () => getCartCompletionRecommendations(products, cart, { limit: 4 }),
    [cart, products]
  );
  const minimumReached = subtotal >= siteConfig.wholesale.minimumOrderCents;

  function update(next: Array<{ slug: string; skuId?: string; quantity: number }>) {
    const clean = next.filter((item) => item.quantity > 0);
    writeCart(clean);
  }

  return (
    <section className="checkout-shell">
      <div className="cart-panel">
        <p className="eyebrow">Carrinho</p>
        <h1>Sua seleção</h1>
        <MinimumOrderNotice subtotalCents={subtotal} />
        {items.length ? (
          items.map((item) => (
            <article className="cart-row" key={cartLineKey(item)}>
              <img src={item.product.image} alt={item.product.name} />
              <div>
                <span>{item.product.brand.name}</span>
                <strong>{item.product.name}</strong>
                {item.sku ? <small>{item.sku.name} #{item.sku.code}</small> : null}
                <small>{money(effectiveSkuPriceCents(item.product, item.sku))}</small>
              </div>
              <div className="qty-control">
                <button
                  type="button"
                  aria-label="Diminuir quantidade"
                  onClick={() =>
                    update(cart.map((line) => (sameCartLine(line, item.slug, item.skuId) ? { ...line, quantity: line.quantity - 1 } : line)))
                  }
                >
                  -
                </button>
                <span>{item.quantity}</span>
                <button
                  type="button"
                  aria-label="Aumentar quantidade"
                  onClick={() =>
                    update(cart.map((line) => (sameCartLine(line, item.slug, item.skuId) ? { ...line, quantity: line.quantity + 1 } : line)))
                  }
                  disabled={((item.sku ? item.sku.quantity : item.product.inventory?.quantity) || 0) <= item.quantity}
                >
                  +
                </button>
              </div>
              <button type="button" className="remove-button" onClick={() => update(cart.filter((line) => !sameCartLine(line, item.slug, item.skuId)))}>
                Remover
              </button>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <strong>Seu carrinho está vazio</strong>
            <p>Escolha produtos do catálogo ou veja as ofertas para montar seu pedido mínimo de atacado.</p>
            <div className="empty-actions">
              <Link className="button primary" href="/categoria/all">
                Explorar catálogo
              </Link>
              <Link className="button secondary" href="/promocoes">
                Ver ofertas
              </Link>
            </div>
          </div>
        )}
      </div>
      <aside className="summary-panel">
        <div className="summary-block">
          <h2>Resumo</h2>
          <div>
            <span>Subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>
          <div>
            <span>Desconto curadoria</span>
            <strong>-{money(discount)}</strong>
          </div>
          <div>
            <span>Frete</span>
            <strong>No checkout</strong>
          </div>
          <div className="summary-total">
            <span>Total sem frete</span>
            <strong>{money(total)}</strong>
          </div>
          <p>
            {siteConfig.wholesale.nationalDeliveryText} {siteConfig.wholesale.nationalDeliveryNote}
          </p>
        </div>
        <div className="delivery-note">
          {siteConfig.wholesale.deliveryModes.map((mode) => (
            <span key={mode}>{mode}</span>
          ))}
        </div>
        <StoreTrustSignals signals={trustSignals} compact />
        {items.length ? (
          <CartCompletionRecommendations
            compact
            recommendations={recommendations}
            title={
              minimumReached
                ? siteConfig.productConversion.completionReachedTitle
                : siteConfig.productConversion.completionTitle
            }
            body={
              minimumReached
                ? siteConfig.productConversion.completionReachedBody
                : siteConfig.productConversion.completionBody
            }
          />
        ) : null}
        {items.length ? (
          <WhatsAppLink href={whatsappHref} className="button whatsapp wide">
            {siteConfig.whatsapp.cartCta}
          </WhatsAppLink>
        ) : null}
        {items.length ? (
          <CustomerCheckoutButton className="button primary wide">Continuar para checkout</CustomerCheckoutButton>
        ) : (
          <Link className="button primary wide disabled" href="/categoria/all">
            Montar pedido
          </Link>
        )}
      </aside>
    </section>
  );
}
