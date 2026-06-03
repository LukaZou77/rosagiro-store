"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { readCart, subscribeQuickPurchaseOpen, useCart, writeCart } from "@/components/CartCount";
import { CartCompletionRecommendations } from "@/components/CartCompletionRecommendations";
import { CustomerCheckoutButton } from "@/components/CustomerSession";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import type { CartCompletionRecommendation } from "@/lib/cart-completion";
import { money } from "@/lib/money";
import { siteConfig } from "@/lib/site-config";
import { buildCartWhatsAppHref } from "@/lib/whatsapp";

type SummaryLine = {
  slug: string;
  name: string;
  brandName: string;
  image: string;
  priceCents: number;
  requestedQuantity: number;
  quantity: number;
  stockQuantity: number;
  active: boolean;
  available: boolean;
  warning: string;
  lineTotalCents: number;
};

type CartSummary = {
  lines: SummaryLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  minimumOrderCents: number;
  remainingToMinimumCents: number;
  minimumReached: boolean;
  recommendations: CartCompletionRecommendation[];
  error?: string;
};

function cartQuantity(cart: Array<{ quantity: number }>) {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function syncQuantity(slug: string, quantity: number) {
  const next = readCart()
    .map((item) => (item.slug === slug ? { ...item, quantity } : item))
    .filter((item) => item.quantity > 0);
  writeCart(next);
}

function removeLine(slug: string) {
  writeCart(readCart().filter((item) => item.slug !== slug));
}

export function QuickPurchaseDrawer() {
  const pathname = usePathname();
  const cart = useCart();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [summaryState, setSummaryState] = useState<{ key: string; data: CartSummary } | null>(null);
  const [errorState, setErrorState] = useState<{ key: string; message: string } | null>(null);
  const count = cartQuantity(cart);
  const cartKey = useMemo(() => JSON.stringify(cart), [cart]);

  useEffect(() => {
    return subscribeQuickPurchaseOpen(() => {
      setOpen(true);
      window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

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
        if (!response.ok) throw new Error(data.error || "Nao foi possivel carregar o resumo.");
        setSummaryState({ key: cartKey, data });
      })
      .catch((fetchError: Error) => {
        if (fetchError.name === "AbortError") return;
        setErrorState({ key: cartKey, message: fetchError.message || "Nao foi possivel carregar o resumo." });
      });

    return () => controller.abort();
  }, [cart, cartKey]);

  const summary = cart.length && summaryState?.key === cartKey ? summaryState.data : null;
  const error = cart.length && errorState?.key === cartKey ? errorState.message : "";
  const loading = cart.length > 0 && !summary && !error;

  const whatsappItems = useMemo(
    () =>
      (summary?.lines || [])
        .filter((line) => line.available && line.quantity > 0)
        .map((line) => ({
          quantity: line.quantity,
          product: {
            name: line.name,
            priceCents: line.priceCents,
            brand: { name: line.brandName }
          }
        })),
    [summary]
  );
  const whatsappHref = useMemo(
    () => buildCartWhatsAppHref(whatsappItems, summary?.subtotalCents || 0),
    [summary?.subtotalCents, whatsappItems]
  );
  const progress =
    summary && summary.minimumOrderCents > 0
      ? Math.min(100, Math.round((summary.subtotalCents / summary.minimumOrderCents) * 100))
      : 0;
  const hasValidLines = whatsappItems.length > 0;
  const hideFloatingEntry =
    pathname.startsWith("/produto/") ||
    pathname === "/checkout" ||
    pathname.startsWith("/pagamento-simulado/") ||
    pathname.startsWith("/pedido/");

  return (
    <>
      {count > 0 && !open && !hideFloatingEntry ? (
        <button className="quick-purchase-fab" type="button" onClick={() => setOpen(true)} aria-label="Abrir pedido rapido">
          <span>Pedido</span>
          <strong>{count}</strong>
        </button>
      ) : null}
      <div className={open ? "quick-drawer-shell open" : "quick-drawer-shell"} aria-hidden={!open}>
        <button className="quick-drawer-overlay" type="button" onClick={() => setOpen(false)} aria-label="Fechar painel de pedido" />
        <aside className="quick-drawer" aria-label="Pedido rapido" aria-modal="true" role="dialog">
          <header className="quick-drawer-header">
            <div>
              <span>Pedido rapido</span>
              <h2>Monte sua lista</h2>
            </div>
            <button ref={closeButtonRef} type="button" onClick={() => setOpen(false)} aria-label="Fechar pedido rapido">
              Fechar
            </button>
          </header>

          <div className="quick-drawer-body" aria-live="polite">
            {!cart.length ? (
              <div className="quick-empty">
                <strong>Carrinho vazio</strong>
                <p>Adicione produtos para montar sua compra de atacado.</p>
                <Link className="button secondary wide" href="/categoria/all" onClick={() => setOpen(false)}>
                  Ver catalogo
                </Link>
              </div>
            ) : loading && !summary ? (
              <div className="quick-loading">Carregando resumo do pedido...</div>
            ) : error ? (
              <div className="quick-empty">
                <strong>Resumo indisponivel</strong>
                <p>{error}</p>
              </div>
            ) : summary ? (
              <>
                <section className="quick-minimum" aria-label="Pedido minimo">
                  <div>
                    <span>{siteConfig.wholesale.minimumOrderTitle}</span>
                    <strong>{money(summary.minimumOrderCents)}</strong>
                  </div>
                  <p>
                    {summary.minimumReached
                      ? "Lista acima do minimo sugerido para atacado."
                      : `Faltam ${money(summary.remainingToMinimumCents)} para atingir o minimo sugerido.`}
                  </p>
                  <div className="minimum-order-meter" aria-hidden="true">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </section>

                <div className="quick-lines">
                  {summary.lines.map((line) => (
                    <article className={line.available ? "quick-line" : "quick-line muted"} key={line.slug}>
                      {line.image ? <img src={line.image} alt={line.name} /> : <div className="quick-line-placeholder" aria-hidden="true" />}
                      <div className="quick-line-info">
                        <span>{line.brandName || "Produto"}</span>
                        <strong>{line.name}</strong>
                        <small>
                          {line.available ? `${money(line.priceCents)} / ${line.stockQuantity} un. em estoque` : line.warning || "Indisponivel"}
                        </small>
                        {line.warning ? <em>{line.warning}</em> : null}
                      </div>
                      <div className="quick-line-actions">
                        <div className="qty-control compact">
                          <button type="button" onClick={() => syncQuantity(line.slug, line.requestedQuantity - 1)} aria-label={`Diminuir ${line.name}`}>
                            -
                          </button>
                          <span>{line.requestedQuantity}</span>
                          <button
                            type="button"
                            onClick={() => syncQuantity(line.slug, line.requestedQuantity + 1)}
                            disabled={!line.available || line.requestedQuantity >= line.stockQuantity}
                            aria-label={`Aumentar ${line.name}`}
                          >
                            +
                          </button>
                        </div>
                        <strong>{money(line.lineTotalCents)}</strong>
                        <button className="remove-button compact" type="button" onClick={() => removeLine(line.slug)}>
                          Remover
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <CartCompletionRecommendations
                  compact
                  recommendations={summary.recommendations}
                  title={
                    summary.minimumReached
                      ? siteConfig.productConversion.completionReachedTitle
                      : siteConfig.productConversion.completionTitle
                  }
                  body={
                    summary.minimumReached
                      ? siteConfig.productConversion.completionReachedBody
                      : `Faltam ${money(summary.remainingToMinimumCents)} para o minimo sugerido.`
                  }
                />

                <section className="quick-summary" aria-label="Resumo do pedido">
                  <div>
                    <span>Subtotal</span>
                    <strong>{money(summary.subtotalCents)}</strong>
                  </div>
                  <div>
                    <span>Desconto curadoria</span>
                    <strong>-{money(summary.discountCents)}</strong>
                  </div>
                  <div>
                    <span>Total sem frete</span>
                    <strong>{money(summary.totalCents)}</strong>
                  </div>
                </section>
              </>
            ) : null}
          </div>

          <footer className="quick-drawer-footer">
            {hasValidLines ? (
              <WhatsAppLink href={whatsappHref} className="button whatsapp wide">
                {siteConfig.whatsapp.cartCta}
              </WhatsAppLink>
            ) : (
              <span className="button whatsapp wide disabled" aria-disabled="true">
                {siteConfig.whatsapp.cartCta}
              </span>
            )}
            {hasValidLines ? (
              <CustomerCheckoutButton className="button primary wide" onProceed={() => setOpen(false)}>
                Continuar para checkout
              </CustomerCheckoutButton>
            ) : (
              <span className="button primary wide disabled" aria-disabled="true">
                Continuar para checkout
              </span>
            )}
            <Link className="button secondary wide" href="/carrinho" onClick={() => setOpen(false)}>
              Ver carrinho completo
            </Link>
          </footer>
        </aside>
      </div>
    </>
  );
}
