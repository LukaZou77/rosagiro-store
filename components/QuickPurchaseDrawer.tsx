"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cartLineKey, readCart, sameCartLine, subscribeQuickPurchaseOpen, useCart, writeCart } from "@/components/CartCount";
import { CartCompletionRecommendations } from "@/components/CartCompletionRecommendations";
import { CustomerCheckoutButton } from "@/components/CustomerSession";
import { OptimizedProductImage } from "@/components/OptimizedProductImage";
import {
  currentQuickPurchaseSummaryState,
  isCurrentQuickPurchaseRequest,
  shouldFetchQuickPurchaseSummary,
  wrappedDialogFocusTarget,
  type QuickPurchaseSummaryState
} from "@/components/QuickPurchaseDrawerState";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { useWhatsAppPhone } from "@/components/WhatsAppProvider";
import type { CartSummary, CartSummaryLine } from "@/lib/cart-summary";
import { money } from "@/lib/money";
import { siteConfig } from "@/lib/site-config";
import { addWholesalePackageQuantity, roundUpToWholesalePackage } from "@/lib/wholesale-order";
import { buildCartWhatsAppHref } from "@/lib/whatsapp";

function syncQuantity(slug: string, quantity: number) {
  const next = readCart()
    .map((item) => (sameCartLine(item, slug) ? { ...item, quantity } : item))
    .filter((item) => item.quantity > 0);
  writeCart(next);
}

function removeLine(slug: string) {
  writeCart(readCart().filter((item) => !sameCartLine(item, slug)));
}

function lineSummaryLabel(line: Pick<CartSummaryLine, "available" | "warning" | "priceCents">) {
  if (!line.available) return line.warning || "Indisponível";
  return `${money(line.priceCents)} / Em estoque`;
}

export function QuickPurchaseDrawer() {
  const pathname = usePathname();
  const whatsappPhone = useWhatsAppPhone();
  const cart = useCart();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const activeRequestRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [requestCycle, setRequestCycle] = useState(0);
  const [summaryState, setSummaryState] = useState<QuickPurchaseSummaryState | null>(null);
  const count = cart.length;
  const cartKey = useMemo(() => JSON.stringify(cart), [cart]);
  const drawerDisabled = pathname === "/checkout";
  const drawerOpen = open && !drawerDisabled;

  const openDrawer = useCallback((opener?: HTMLElement | null) => {
    if (drawerDisabled) return;
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const candidate = opener || activeElement;
    // Adding another item inside an already-open drawer must not replace the
    // external return-focus target with a control that will be hidden on close.
    if (!candidate || !drawerRef.current?.contains(candidate)) {
      openerRef.current = candidate && candidate !== document.body && candidate !== document.documentElement ? candidate : null;
    }
    setRequestCycle((current) => current + 1);
    setOpen(true);
    window.setTimeout(() => closeButtonRef.current?.focus({ preventScroll: true }), 0);
  }, [drawerDisabled]);

  const closeDrawer = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => {
      const opener = openerRef.current;
      const fallback = document.getElementById("conteudo-principal");
      const target = opener?.isConnected && !opener.hasAttribute("disabled") ? opener : fallback;
      target?.focus({ preventScroll: true });
    }, 0);
  }, []);

  useEffect(() => {
    return subscribeQuickPurchaseOpen(() => openDrawer());
  }, [openDrawer]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;

      const drawer = drawerRef.current;
      if (!drawer) return;
      const focusableElements = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
        )
      ).filter((element) => !element.hasAttribute("disabled"));
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const target = wrappedDialogFocusTarget({
        elements: focusableElements,
        activeElement,
        activeInside: Boolean(activeElement && drawer.contains(activeElement)),
        shiftKey: event.shiftKey
      });
      if (!target) return;
      event.preventDefault();
      target.focus({ preventScroll: true });
    }

    if (drawerOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDrawer, drawerOpen]);

  useEffect(() => {
    if (!shouldFetchQuickPurchaseSummary({ drawerOpen, cartLength: cart.length })) return;

    const controller = new AbortController();
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    fetch("/api/cart/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart }),
      signal: controller.signal
    })
      .then(async (response) => {
        const data = (await response.json()) as CartSummary;
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar o resumo.");
        if (
          !isCurrentQuickPurchaseRequest({
            requestId,
            activeRequestId: activeRequestRef.current,
            aborted: controller.signal.aborted
          })
        ) return;
        setSummaryState({ cartKey, requestCycle, status: "success", data });
      })
      .catch((fetchError: Error) => {
        if (
          fetchError.name === "AbortError" ||
          !isCurrentQuickPurchaseRequest({
            requestId,
            activeRequestId: activeRequestRef.current,
            aborted: controller.signal.aborted
          })
        ) return;
        setSummaryState({
          cartKey,
          requestCycle,
          status: "error",
          message: fetchError.message || "Não foi possível carregar o resumo."
        });
      });

    return () => {
      controller.abort();
      if (activeRequestRef.current === requestId) activeRequestRef.current += 1;
    };
  }, [cart, cartKey, drawerOpen, requestCycle]);

  const currentSummaryState = currentQuickPurchaseSummaryState(summaryState, cartKey, requestCycle);
  const summary = cart.length && currentSummaryState?.status === "success" ? currentSummaryState.data : null;
  const error = cart.length && currentSummaryState?.status === "error" ? currentSummaryState.message : "";
  const loading = cart.length > 0 && !summary && !error;

  const whatsappItems = useMemo(
    () =>
      (summary?.lines || [])
        .filter((line) => line.available && line.packageValid && line.quantity > 0)
        .map((line) => ({
          quantity: line.quantity,
          packagePieces: line.packagePieces,
          product: {
            name: line.name,
            priceCents: line.priceCents,
            brand: { name: line.brandName }
          }
        })),
    [summary]
  );
  const whatsappHref = useMemo(
    () => buildCartWhatsAppHref(whatsappItems, summary?.subtotalCents || 0, whatsappPhone),
    [summary?.subtotalCents, whatsappItems, whatsappPhone]
  );
  const progress =
    summary && summary.minimumOrderCents > 0
      ? Math.min(100, Math.round((summary.subtotalCents / summary.minimumOrderCents) * 100))
      : 0;
  const hasValidLines = whatsappItems.length > 0;
  const hideFloatingEntry =
    pathname === "/" ||
    pathname === "/carrinho" ||
    pathname.startsWith("/categoria/") ||
    pathname === "/promocoes" ||
    pathname.startsWith("/produto/") ||
    drawerDisabled ||
    pathname.startsWith("/pagamento-simulado/") ||
    pathname.startsWith("/pedido/");

  return (
    <>
      {count > 0 && !drawerOpen && !hideFloatingEntry ? (
        <button
          className="quick-purchase-fab"
          type="button"
          onClick={(event) => openDrawer(event.currentTarget)}
          aria-label="Abrir pedido rápido"
        >
          <span>Pedido</span>
          <strong>{count}</strong>
        </button>
      ) : null}
      <div className={drawerOpen ? "quick-drawer-shell open" : "quick-drawer-shell"} aria-hidden={!drawerOpen}>
        <button className="quick-drawer-overlay" type="button" onClick={closeDrawer} aria-label="Fechar painel de pedido" />
        <aside className="quick-drawer" aria-label="Pedido rápido" aria-modal="true" ref={drawerRef} role="dialog">
          <header className="quick-drawer-header">
            <div>
              <span>Pedido rápido</span>
              <h2>Monte sua lista</h2>
            </div>
            <button ref={closeButtonRef} type="button" onClick={closeDrawer} aria-label="Fechar pedido rápido">
              Fechar
            </button>
          </header>

          <div className="quick-drawer-body" aria-live="polite">
            {!cart.length ? (
              <div className="quick-empty">
                <strong>Pedido vazio</strong>
                <p>Adicione produtos para montar sua compra de atacado.</p>
                <Link className="button secondary wide" href="/categoria/all" onClick={() => setOpen(false)}>
                  Ver catálogo
                </Link>
              </div>
            ) : loading && !summary ? (
              <div className="quick-loading">Carregando resumo do pedido...</div>
            ) : error ? (
              <div className="quick-empty">
                <strong>Resumo indisponível</strong>
                <p>{error}</p>
              </div>
            ) : summary ? (
              <>
                <section className="quick-minimum" aria-label="Pedido mínimo">
                  <div>
                    <span>{siteConfig.wholesale.minimumOrderTitle}</span>
                    <strong>{money(summary.minimumOrderCents)}</strong>
                  </div>
                  <p>
                    {summary.minimumReached
                      ? "Pedido mínimo para atacado atingido."
                      : `Faltam ${money(summary.remainingToMinimumCents)} para liberar o checkout de atacado.`}
                  </p>
                  <div className="minimum-order-meter" aria-hidden="true">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </section>

                <div className="quick-lines">
                    {summary.lines.map((line) => (
                      <article className={line.available ? "quick-line" : "quick-line muted"} key={cartLineKey({ slug: line.slug })}>
                        {line.image ? (
                          <OptimizedProductImage src={line.image} alt={line.name} width={72} height={86} sizes="72px" />
                        ) : (
                          <div className="quick-line-placeholder" aria-hidden="true" />
                        )}
                        <div className="quick-line-info">
                          <span>{line.brandName || "Produto"}</span>
                          <strong>{line.name}</strong>
                          <small>{lineSummaryLabel(line)}</small>
                          {line.packagePieces ? (
                            <small>
                              {line.packageValid
                                ? `${line.packageCount} ${line.packageCount === 1 ? "embalagem" : "embalagens"} · ${line.requestedQuantity} unidades`
                                : `Embalagem fechada: ${line.packagePieces} unidades`}
                            </small>
                          ) : null}
                        {line.warning ? <em>{line.warning}</em> : null}
                      </div>
                      <div className="quick-line-actions">
                        {line.packagePieces && !line.packageValid ? (
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => syncQuantity(line.slug, roundUpToWholesalePackage(line.requestedQuantity, line.packagePieces))}
                          >
                            Ajustar embalagem
                          </button>
                        ) : (
                          <div className="qty-control compact">
                              <button
                                type="button"
                                onClick={() => syncQuantity(line.slug, line.requestedQuantity - (line.packagePieces || 1))}
                                aria-label={`Diminuir uma embalagem de ${line.name}`}
                              >
                              -
                            </button>
                            <span>{line.packageCount} emb.</span>
                            <button
                              type="button"
                              onClick={() =>
                                syncQuantity(
                                  line.slug,
                                  addWholesalePackageQuantity(
                                    line.requestedQuantity,
                                    line.packagePieces || 1,
                                    line.stockQuantity
                                  )
                                )
                              }
                              disabled={!line.available || line.requestedQuantity + (line.packagePieces || 1) > line.stockQuantity}
                              aria-label={`Aumentar uma embalagem de ${line.name}`}
                            >
                              +
                            </button>
                          </div>
                        )}
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
                      : `Faltam ${money(summary.remainingToMinimumCents)} para o pedido mínimo.`
                  }
                />

                <section className="quick-summary" aria-label="Resumo do pedido">
                  <div>
                    <span>Subtotal</span>
                    <strong>{money(summary.subtotalCents)}</strong>
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
              <CustomerCheckoutButton
                className="button primary wide"
                disabled={!summary?.minimumReached || !summary?.packageReady}
                onProceed={() => setOpen(false)}
              >
                {!summary?.packageReady ? "Ajuste as embalagens" : summary.minimumReached ? "Continuar pedido" : "Complete o pedido mínimo"}
              </CustomerCheckoutButton>
            ) : (
              <span className="button primary wide disabled" aria-disabled="true">
                Continuar pedido
              </span>
            )}
            <Link className="button secondary wide" href="/carrinho" onClick={() => setOpen(false)}>
              Ver pedido completo
            </Link>
          </footer>
        </aside>
      </div>
    </>
  );
}
