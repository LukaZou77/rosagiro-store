"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cartLineKey, readCart, sameCartLine, subscribeQuickPurchaseOpen, useCart, writeCart } from "@/components/CartCount";
import { CartCompletionRecommendations } from "@/components/CartCompletionRecommendations";
import { CustomerCheckoutButton } from "@/components/CustomerSession";
import { OptimizedProductImage } from "@/components/OptimizedProductImage";
import {
  currentQuickPurchaseSummaryState,
  isCurrentQuickPurchaseRequest,
  shouldFetchQuickPurchaseSummary,
  type QuickPurchaseSummaryState
} from "@/components/QuickPurchaseDrawerState";
import { closeStoreDialog, trapStoreDialogFocus } from "@/components/storeDialog";
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

function lineSummaryLabel(line: Pick<CartSummaryLine, "available" | "packagePriceCents" | "priceCents">) {
  if (line.packagePriceCents !== null) return `${money(line.packagePriceCents)} por embalagem`;
  return line.available ? money(line.priceCents) : "Indisponível";
}

export function QuickPurchaseDrawer() {
  const pathname = usePathname();
  const whatsappPhone = useWhatsAppPhone();
  const cart = useCart();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDialogElement | null>(null);
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
    if (!drawerRef.current?.open) {
      openerRef.current = candidate && candidate !== document.body && candidate !== document.documentElement ? candidate : null;
    }
    setRequestCycle((current) => current + 1);
    setOpen(true);
  }, [drawerDisabled]);

  function closeDrawer() {
    setOpen(false);
  }

  useEffect(() => {
    return subscribeQuickPurchaseOpen(() => openDrawer());
  }, [openDrawer]);

  useLayoutEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    if (!drawerOpen) {
      closeStoreDialog(drawer, openerRef.current);
    } else if (!drawer.open) {
      drawer.showModal();
      closeButtonRef.current?.focus({ preventScroll: true });
    }
  }, [drawerOpen]);

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
          lineTotalCents: line.lineTotalCents,
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
      {count > 0 && !hideFloatingEntry ? (
        <button
          className="quick-purchase-fab"
          type="button"
          hidden={drawerOpen}
          onClick={(event) => openDrawer(event.currentTarget)}
          aria-label="Abrir pedido rápido"
        >
          <span>Pedido</span>
          <strong>{count}</strong>
        </button>
      ) : null}
      <dialog
        className="quick-drawer-shell"
        aria-label="Pedido rápido"
        ref={drawerRef}
        onCancel={(event) => {
          event.preventDefault();
          closeDrawer();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDrawer();
        }}
        onKeyDown={trapStoreDialogFocus}
      >
        <aside className="quick-drawer">
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
                <Link className="button secondary wide" href="/categoria/all" onClick={closeDrawer}>
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
                  {summary.lines.map((line) => {
                    const packagePieces = line.packagePieces || 1;
                    const adjustedQuantity = line.active && line.packagePriceCents && (!line.packageValid || !line.available)
                      ? roundUpToWholesalePackage(line.requestedQuantity, packagePieces, line.stockQuantity)
                      : 0;
                    const nextQuantity = addWholesalePackageQuantity(line.requestedQuantity, packagePieces, line.stockQuantity);

                    return (
                      <article className={line.available ? "quick-line" : "quick-line muted"} key={cartLineKey(line)}>
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
                          {adjustedQuantity > 0 ? (
                            <button className="button secondary" type="button" onClick={() => syncQuantity(line.slug, adjustedQuantity)}>
                              Ajustar embalagem
                            </button>
                          ) : line.available && line.packageValid ? (
                            <div className="qty-control compact">
                              <button
                                type="button"
                                onClick={() => syncQuantity(line.slug, line.requestedQuantity - packagePieces)}
                                aria-label={`Diminuir uma embalagem de ${line.name}`}
                              >
                                −
                              </button>
                              <span>{line.packageCount} emb.</span>
                              <button
                                type="button"
                                onClick={() => syncQuantity(line.slug, nextQuantity)}
                                disabled={nextQuantity <= line.requestedQuantity}
                                aria-label={`Aumentar uma embalagem de ${line.name}`}
                              >
                                +
                              </button>
                            </div>
                          ) : null}
                          {line.lineTotalCents > 0 ? <strong>{money(line.lineTotalCents)}</strong> : null}
                          <button
                            className="remove-button compact"
                            type="button"
                            aria-label={`Remover ${line.name}`}
                            onClick={() => removeLine(line.slug)}
                          >
                            Remover
                          </button>
                        </div>
                      </article>
                    );
                  })}
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
                  {summary.orderLimitNotice ? <p role="status">{summary.orderLimitNotice}</p> : null}
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
                onProceed={closeDrawer}
              >
                {summary?.orderLimitNotice ? "Reduza a quantidade" : !summary?.packageReady ? "Ajuste o pedido" : summary.minimumReached ? "Continuar pedido" : "Complete o pedido mínimo"}
              </CustomerCheckoutButton>
            ) : (
              <span className="button primary wide disabled" aria-disabled="true">
                Continuar pedido
              </span>
            )}
            <Link className="button secondary wide" href="/carrinho" onClick={closeDrawer}>
              Ver pedido completo
            </Link>
          </footer>
        </aside>
      </dialog>
    </>
  );
}
