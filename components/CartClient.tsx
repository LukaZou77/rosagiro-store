"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCart, writeCart } from "@/components/CartCount";
import { CartCompletionRecommendations } from "@/components/CartCompletionRecommendations";
import { CustomerCheckoutButton } from "@/components/CustomerSession";
import { MinimumOrderNotice } from "@/components/MinimumOrderNotice";
import { StoreTrustSignals } from "@/components/StoreTrustSignals";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { useWhatsAppPhone } from "@/components/WhatsAppProvider";
import { getCartCompletionRecommendations } from "@/lib/cart-completion";
import { money } from "@/lib/money";
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
};

export function CartClient({ products, trustSignals }: { products: Product[]; trustSignals: string[] }) {
  const cart = useCart();
  const whatsappPhone = useWhatsAppPhone();

  const productMap = useMemo(() => new Map(products.map((product) => [product.slug, product])), [products]);
  const items = useMemo(
    () =>
      cart
        .map((item) => ({ ...item, product: productMap.get(item.slug) }))
        .filter((item): item is { slug: string; quantity: number; product: Product } => Boolean(item.product)),
    [cart, productMap]
  );
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0), [items]);
  const discount = subtotal >= 25000 ? Math.round(subtotal * 0.1) : 0;
  const total = subtotal - discount;
  const whatsappHref = useMemo(() => buildCartWhatsAppHref(items, subtotal, whatsappPhone), [items, subtotal, whatsappPhone]);
  const recommendations = useMemo(
    () => getCartCompletionRecommendations(products, cart, { limit: 4 }),
    [cart, products]
  );
  const minimumReached = subtotal >= siteConfig.wholesale.minimumOrderCents;

  function update(next: Array<{ slug: string; quantity: number }>) {
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
            <article className="cart-row" key={item.slug}>
              <img src={item.product.image} alt={item.product.name} />
              <div>
                <span>{item.product.brand.name}</span>
                <strong>{item.product.name}</strong>
                <small>{money(item.product.priceCents)}</small>
              </div>
              <div className="qty-control">
                <button
                  type="button"
                  aria-label="Diminuir quantidade"
                  onClick={() =>
                    update(cart.map((line) => (line.slug === item.slug ? { ...line, quantity: line.quantity - 1 } : line)))
                  }
                >
                  -
                </button>
                <span>{item.quantity}</span>
                <button
                  type="button"
                  aria-label="Aumentar quantidade"
                  onClick={() =>
                    update(cart.map((line) => (line.slug === item.slug ? { ...line, quantity: line.quantity + 1 } : line)))
                  }
                  disabled={(item.product.inventory?.quantity || 0) <= item.quantity}
                >
                  +
                </button>
              </div>
              <button type="button" className="remove-button" onClick={() => update(cart.filter((line) => line.slug !== item.slug))}>
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
          <p>Frete Anjun D2D Pickup será estimado por CEP no checkout. Retirada local continua disponível.</p>
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
