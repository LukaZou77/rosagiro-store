import Link from "next/link";
import { AddToCartButton } from "@/components/AddToCartButton";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import type { CatalogProduct } from "@/lib/catalog";
import { customerDisplayText } from "@/lib/display-text";
import { money } from "@/lib/money";
import { lowestEffectivePriceCents, hasSkuPriceRange } from "@/lib/product-pricing";
import {
  productHeroBadge,
  productHasActiveSkus,
  productPurchaseSignals,
  productQuantity,
  productShortStockLabel,
  productStockTone
} from "@/lib/product-conversion";
import { siteConfig } from "@/lib/site-config";
import { buildProductWhatsAppHref } from "@/lib/whatsapp";

export function ProductCard({ product, whatsappPhone }: { product: CatalogProduct; whatsappPhone?: string | null }) {
  const quantity = productQuantity(product);
  const available = quantity > 0;
  const hasSkuChoices = productHasActiveSkus(product);
  const heroBadge = productHeroBadge(product);
  const stockTone = productStockTone(product);
  const shortStockLabel = productShortStockLabel(product);
  const purchaseSignals = productPurchaseSignals(product);
  const whatsappHref = buildProductWhatsAppHref(product, whatsappPhone);
  const displayPrice = lowestEffectivePriceCents(product);
  const showFromPrice = hasSkuPriceRange(product);
  const visibleBadges = product.badges
    .map(customerDisplayText)
    .filter((badge) => !/^em estoque$/i.test(badge.trim()))
    .slice(0, 2);

  return (
    <article className={available ? "product-card" : "product-card is-unavailable"}>
      <Link href={`/produto/${product.slug}`} className="product-image">
        {heroBadge ? <span className="product-badge">{heroBadge}</span> : null}
        <img src={product.image} alt={product.name} loading="lazy" />
      </Link>
      <div className="product-card-body">
        <div className="product-meta-line">
          <span>{product.brand.name}</span>
          <small className={`stock-chip ${stockTone}`}>{shortStockLabel}</small>
        </div>
        <Link href={`/produto/${product.slug}`}>
          <h3>{product.name}</h3>
        </Link>
        <p>{product.subcategory}</p>
        {purchaseSignals.length ? (
          <div className="purchase-signals" aria-label="Sinais de compra">
            {purchaseSignals.map((signal) => (
              <span key={signal}>{signal}</span>
            ))}
          </div>
        ) : null}
        {visibleBadges.length || !available ? (
          <div className="mini-badge-row">
            {visibleBadges.map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
            {!available ? <span>{siteConfig.productConversion.unavailableCta}</span> : null}
          </div>
        ) : null}
        <div className="product-card-bottom">
          <div className="price-stack">
            <strong>{showFromPrice ? `A partir de ${money(displayPrice)}` : money(displayPrice)}</strong>
          </div>
          <div className="product-card-actions">
            {hasSkuChoices ? (
              <Link className={available ? "button primary" : "button primary disabled"} href={`/produto/${product.slug}`}>
                Escolher variação
              </Link>
            ) : (
              <AddToCartButton slug={product.slug} label="Comprar" disabled={!available} />
            )}
            <WhatsAppLink href={whatsappHref} className="whatsapp-inline" ariaLabel={`Consultar ${product.name} no WhatsApp`}>
              {siteConfig.whatsapp.productSecondaryCta}
            </WhatsAppLink>
          </div>
        </div>
      </div>
    </article>
  );
}
