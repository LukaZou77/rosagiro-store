"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCart, writeCart } from "@/components/CartCount";
import { MinimumOrderNotice } from "@/components/MinimumOrderNotice";
import { money } from "@/lib/money";
import { siteConfig } from "@/lib/site-config";

type Product = {
  slug: string;
  name: string;
  image: string;
  priceCents: number;
  subcategory: string;
  brand: { name: string };
  inventory: { quantity: number } | null;
};

export function CartClient({ products }: { products: Product[] }) {
  const cart = useCart();

  const productMap = useMemo(() => new Map(products.map((product) => [product.slug, product])), [products]);
  const items = cart
    .map((item) => ({ ...item, product: productMap.get(item.slug) }))
    .filter((item): item is { slug: string; quantity: number; product: Product } => Boolean(item.product));
  const subtotal = items.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0);
  const discount = subtotal >= 25000 ? Math.round(subtotal * 0.1) : 0;
  const shipping = subtotal >= 29900 ? 0 : 1490;
  const total = subtotal - discount + shipping;

  function update(next: Array<{ slug: string; quantity: number }>) {
    const clean = next.filter((item) => item.quantity > 0);
    writeCart(clean);
  }

  return (
    <section className="checkout-shell">
      <div className="cart-panel">
        <p className="eyebrow">Carrinho</p>
        <h1>Sua selecao</h1>
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
            <strong>Seu carrinho esta vazio</strong>
            <p>Explore categorias e adicione produtos para testar o fluxo.</p>
            <Link className="button secondary" href="/categoria/all">
              Explorar catalogo
            </Link>
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
            <span>Frete estimado</span>
            <strong>{shipping === 0 ? "Gratis" : money(shipping)}</strong>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          <p>Frete gratis acima de R$ 299,00. Desconto automatico de 10% acima de R$ 250,00.</p>
        </div>
        <div className="delivery-note">
          {siteConfig.wholesale.deliveryModes.map((mode) => (
            <span key={mode}>{mode}</span>
          ))}
        </div>
        <Link className={`button primary wide ${items.length ? "" : "disabled"}`} href={items.length ? "/checkout" : "/categoria/all"}>
          {items.length ? "Continuar para checkout" : "Ver produtos"}
        </Link>
      </aside>
    </section>
  );
}
