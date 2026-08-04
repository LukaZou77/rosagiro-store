"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cartLineKey, sameCartLine, useCart, writeCart } from "@/components/CartCount";
import { CartCompletionRecommendations } from "@/components/CartCompletionRecommendations";
import { CustomerCheckoutButton } from "@/components/CustomerSession";
import { MinimumOrderNotice } from "@/components/MinimumOrderNotice";
import { OptimizedProductImage } from "@/components/OptimizedProductImage";
import { StoreTrustSignals } from "@/components/StoreTrustSignals";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { useWhatsAppPhone } from "@/components/WhatsAppProvider";
import type { CartSummary } from "@/lib/cart-summary";
import { money } from "@/lib/money";
import { siteConfig } from "@/lib/site-config";
import { addWholesalePackageQuantity, roundUpToWholesalePackage } from "@/lib/wholesale-order";
import { buildCartWhatsAppHref } from "@/lib/whatsapp";

type CartSummaryState = {
  key: string;
  data: CartSummary;
};

function cleanCart(next: Array<{ slug: string; quantity: number }>) {
  return next.filter((item) => item.quantity > 0);
}

export function CartClient({ trustSignals }: { trustSignals: string[] }) {
  const cart = useCart();
  const whatsappPhone = useWhatsAppPhone();
  const cartKey = useMemo(() => JSON.stringify(cart), [cart]);
  const [summaryState, setSummaryState] = useState<CartSummaryState | null>(null);
  const [errorState, setErrorState] = useState<{ key: string; message: string } | null>(null);

  useEffect(() => {
    if (!cart.length) {
      return;
    }

    const controller = new AbortController();
    fetch("/api/cart/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart }),
      signal: controller.signal
    })
      .then(async (response) => {
        const data = (await response.json()) as CartSummary;
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar o resumo.");
        setSummaryState({ key: cartKey, data });
        setErrorState(null);
      })
      .catch((fetchError: Error) => {
        if (fetchError.name === "AbortError") return;
        setErrorState({ key: cartKey, message: fetchError.message || "Não foi possível carregar o resumo." });
      });

    return () => controller.abort();
  }, [cart, cartKey]);

  const summary = cart.length && summaryState?.key === cartKey ? summaryState.data : null;
  const error = cart.length && errorState?.key === cartKey ? errorState.message : "";
  const loading = cart.length > 0 && !summary && !error;
  const lines = useMemo(() => summary?.lines ?? [], [summary]);
  const subtotal = summary?.subtotalCents || 0;
  const total = summary?.totalCents || subtotal;
  const recommendations = summary?.recommendations || [];
  const minimumReached = summary?.minimumReached ?? subtotal >= siteConfig.wholesale.minimumOrderCents;
  const packageReady = summary?.packageReady ?? false;
  const whatsappItems = useMemo(
    () =>
      lines
        .filter((line) => line.available && line.packageValid && line.quantity > 0)
        .map((line) => ({
          quantity: line.quantity,
          packagePieces: line.packagePieces,
          lineTotalCents: line.lineTotalCents,
          product: {
            name: line.name,
            priceCents: line.priceCents,
            brand: { name: line.brandName }
          }
        })),
    [lines]
  );
  const whatsappHref = useMemo(() => buildCartWhatsAppHref(whatsappItems, subtotal, whatsappPhone), [whatsappItems, subtotal, whatsappPhone]);
  const hasValidLines = whatsappItems.length > 0;

  function update(next: Array<{ slug: string; quantity: number }>) {
    writeCart(cleanCart(next));
  }

  return (
    <section className="checkout-shell">
      <div className="cart-panel">
        <p className="eyebrow">Pedido de atacado</p>
        <h1>Monte seu pedido</h1>
        <MinimumOrderNotice subtotalCents={subtotal} />
        {!cart.length ? (
          <div className="empty-state">
            <strong>Seu pedido está vazio</strong>
            <p>Escolha produtos do catálogo ou veja os destaques para montar seu pedido mínimo de atacado.</p>
            <div className="empty-actions">
              <Link className="button primary" href="/categoria/all">
                Explorar catálogo
              </Link>
              <Link className="button secondary" href="/promocoes">
                Ver destaques
              </Link>
            </div>
          </div>
        ) : loading ? (
          <div className="empty-state">
            <strong>Carregando resumo</strong>
            <p>Estamos conferindo preços, embalagens e disponibilidade dos itens do seu pedido.</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <strong>Resumo indisponível</strong>
            <p>{error}</p>
            <div className="empty-actions">
              <Link className="button secondary" href="/categoria/all">
                Voltar ao catálogo
              </Link>
            </div>
          </div>
        ) : lines.length ? (
          lines.map((line) => (
            <article className={line.available ? "cart-row" : "cart-row muted"} key={cartLineKey({ slug: line.slug })}>
              {line.image ? (
                <OptimizedProductImage src={line.image} alt={line.name} width={80} height={96} sizes="80px" />
              ) : (
                <div className="quick-line-placeholder" aria-hidden="true" />
              )}
              <div>
                <span>{line.brandName}</span>
                <strong>{line.name}</strong>
                <small>{money(line.priceCents)} por unidade</small>
                {line.packagePieces ? (
                  <small>
                    {line.packageValid
                      ? `${line.packageCount} ${line.packageCount === 1 ? "embalagem" : "embalagens"} fechada${line.packageCount === 1 ? "" : "s"} · ${line.requestedQuantity} unidades`
                      : `Embalagem fechada: ${line.packagePieces} unidades`}
                  </small>
                ) : null}
                {line.packagePieces ? <small>Cores e variações conforme a composição original da embalagem.</small> : null}
                {line.warning ? <em>{line.warning}</em> : null}
              </div>
              {line.packagePieces && !line.packageValid ? (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() =>
                    update(
                      cart.map((item) =>
                        sameCartLine(item, line.slug)
                          ? { ...item, quantity: roundUpToWholesalePackage(item.quantity, line.packagePieces) }
                          : item
                      )
                    )
                  }
                >
                  Ajustar para embalagem fechada
                </button>
              ) : (
                <div className="qty-control">
                  <button
                    type="button"
                    aria-label="Diminuir uma embalagem"
                    onClick={() =>
                      update(cart.map((item) =>
                        sameCartLine(item, line.slug)
                          ? { ...item, quantity: item.quantity - (line.packagePieces || 1) }
                          : item
                      ))
                    }
                  >
                    -
                  </button>
                  <span>{line.packageCount} emb.</span>
                  <button
                    type="button"
                    aria-label="Aumentar uma embalagem"
                    onClick={() =>
                      update(cart.map((item) =>
                        sameCartLine(item, line.slug)
                          ? {
                              ...item,
                              quantity: addWholesalePackageQuantity(
                                item.quantity,
                                line.packagePieces || 1,
                                line.stockQuantity
                              )
                            }
                          : item
                      ))
                    }
                    disabled={!line.available || line.requestedQuantity + (line.packagePieces || 1) > line.stockQuantity}
                  >
                    +
                  </button>
                </div>
              )}
              <button type="button" className="remove-button" onClick={() => update(cart.filter((item) => !sameCartLine(item, line.slug)))}>
                Remover
              </button>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <strong>Nenhum item disponível</strong>
            <p>Os itens do carrinho não estão disponíveis agora. Remova-os ou fale com o atendimento.</p>
          </div>
        )}
      </div>
      <aside className="summary-panel">
        <div className="summary-block">
          <h2>Resumo do pedido</h2>
          <div>
            <span>Subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>
          <div>
            <span>Frete</span>
            <strong>Calculado no checkout</strong>
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
        {hasValidLines ? (
          <CartCompletionRecommendations
            compact
            recommendations={recommendations}
            title={minimumReached ? siteConfig.productConversion.completionReachedTitle : siteConfig.productConversion.completionTitle}
            body={minimumReached ? siteConfig.productConversion.completionReachedBody : siteConfig.productConversion.completionBody}
          />
        ) : null}
        {hasValidLines ? (
          <WhatsAppLink href={whatsappHref} className="button whatsapp wide">
            {siteConfig.whatsapp.cartCta}
          </WhatsAppLink>
        ) : null}
        {hasValidLines ? (
          <CustomerCheckoutButton className="button primary wide" disabled={!minimumReached || !packageReady}>
            {!packageReady ? "Ajuste as embalagens" : minimumReached ? "Continuar pedido" : "Complete o pedido mínimo"}
          </CustomerCheckoutButton>
        ) : (
          <Link className="button primary wide disabled" href="/categoria/all">
            Montar pedido
          </Link>
        )}
      </aside>
    </section>
  );
}
