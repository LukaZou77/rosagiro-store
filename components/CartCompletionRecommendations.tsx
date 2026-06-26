"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { notifyQuickPurchaseOpen, readCart, writeCart } from "@/components/CartCount";
import { useCustomerSession } from "@/components/CustomerSession";
import { OptimizedProductImage } from "@/components/OptimizedProductImage";
import type { CartCompletionRecommendation } from "@/lib/cart-completion";
import { money } from "@/lib/money";
import { siteConfig } from "@/lib/site-config";

type Props = {
  recommendations: CartCompletionRecommendation[];
  title?: string;
  body?: string;
  compact?: boolean;
  openDrawerOnAdd?: boolean;
};

export function CartCompletionRecommendations({
  recommendations,
  title = siteConfig.productConversion.completionTitle,
  body = siteConfig.productConversion.completionBody,
  compact = false,
  openDrawerOnAdd = false
}: Props) {
  const { requireCustomerSession } = useCustomerSession();
  const [addedSlug, setAddedSlug] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!recommendations.length) return null;

  function addRecommendation(recommendation: CartCompletionRecommendation) {
    const cart = readCart();
    const existing = cart.find((item) => item.slug === recommendation.slug);
    if (existing) existing.quantity = Math.min(existing.quantity + 1, recommendation.stockQuantity);
    else cart.push({ slug: recommendation.slug, quantity: 1 });
    writeCart(cart);
    if (openDrawerOnAdd) notifyQuickPurchaseOpen();
    setAddedSlug(recommendation.slug);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setAddedSlug(""), 1200);
  }

  return (
    <section className={compact ? "completion-panel compact" : "completion-panel"} aria-label={title}>
      <div className="completion-header">
        <div>
          <span>{siteConfig.productConversion.completionEyebrow}</span>
          <h2>{title}</h2>
        </div>
        <p>{body}</p>
      </div>
      <div className="completion-list">
        {recommendations.map((recommendation) => {
          const isAdded = addedSlug === recommendation.slug;

          return (
            <article className="completion-item" key={recommendation.slug}>
              <Link className="completion-image" href={`/produto/${recommendation.slug}`} aria-label={recommendation.name}>
                <OptimizedProductImage src={recommendation.image} alt={recommendation.name} fill sizes="96px" />
              </Link>
              <div className="completion-copy">
                <span>{recommendation.reason}</span>
                <Link href={`/produto/${recommendation.slug}`}>
                  <strong>{recommendation.name}</strong>
                </Link>
                <small>{recommendation.brandName} / Em estoque</small>
                <div className="completion-price">
                  <b>{money(recommendation.priceCents)}</b>
                </div>
              </div>
              {recommendation.hasSkuChoices ? (
                <Link className="completion-link-button" href={`/produto/${recommendation.slug}`}>
                  Escolher variação
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (requireCustomerSession({ intent: "add_to_cart", onSuccess: () => addRecommendation(recommendation) })) {
                      addRecommendation(recommendation);
                    }
                  }}
                >
                  {isAdded ? siteConfig.productConversion.completionAddedCta : siteConfig.productConversion.completionAddCta}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
