import Link from "next/link";
import { AddToCartButton } from "@/components/AddToCartButton";
import { OptimizedProductImage } from "@/components/OptimizedProductImage";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import type { CatalogProduct } from "@/lib/catalog";
import { customerDisplayText } from "@/lib/display-text";
import { money } from "@/lib/money";
import { lowestEffectivePriceCents, hasSkuPriceRange } from "@/lib/product-pricing";
import {
  productHasActiveSkus,
  productQuantity,
  productShortStockLabel,
  productStockTone
} from "@/lib/product-conversion";
import { siteConfig } from "@/lib/site-config";
import { buildProductWhatsAppHref } from "@/lib/whatsapp";

function normalizedLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isSpecialCardBadge(badge: string) {
  const normalized = normalizedLabel(badge);
  if (!normalized || /^(atacado|em estoque|sem estoque|批发|有存货|缺货)/i.test(normalized)) return false;
  return /^(destaque|novo|mais vendido|favorito|lancamento|lançamento|top)$/i.test(normalized);
}

function productCardTags(product: CatalogProduct) {
  const tags = [product.category.label, product.subcategory].map(customerDisplayText).filter(Boolean);
  const seen = new Set<string>();

  return tags.filter((tag) => {
    const key = normalizedLabel(tag);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 2);
}

export function ProductCard({ product, whatsappPhone }: { product: CatalogProduct; whatsappPhone?: string | null }) {
  const quantity = productQuantity(product);
  const available = quantity > 0;
  const hasSkuChoices = productHasActiveSkus(product);
  const heroBadge = product.badges.map(customerDisplayText).find(isSpecialCardBadge) || "";
  const stockTone = productStockTone(product);
  const shortStockLabel = productShortStockLabel(product);
  const whatsappHref = buildProductWhatsAppHref(product, whatsappPhone);
  const displayPrice = lowestEffectivePriceCents(product);
  const showFromPrice = hasSkuPriceRange(product);
  const infoTags = productCardTags(product);

  return (
    <article className={available ? "product-card" : "product-card is-unavailable"}>
      <Link href={`/produto/${product.slug}`} className="product-image">
        {heroBadge ? <span className="product-badge">{heroBadge}</span> : null}
        <OptimizedProductImage
          src={product.image}
          alt={product.name}
          fill
          sizes="(min-width: 1180px) 23vw, (min-width: 760px) 31vw, 50vw"
        />
      </Link>
      <div className="product-card-body">
        <div className="product-meta-line">
          <span>{product.brand.name}</span>
          <small className={`stock-chip ${stockTone}`}>{shortStockLabel}</small>
        </div>
        <Link href={`/produto/${product.slug}`}>
          <h3>{product.name}</h3>
        </Link>
        {infoTags.length ? (
          <div className="product-card-tags" aria-label="Área de uso e tipo do produto">
            {infoTags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}
        <div className="product-card-bottom">
          <div className="price-stack">
            <strong>{showFromPrice ? `A partir de ${money(displayPrice)}` : money(displayPrice)}</strong>
          </div>
          <div className="product-card-actions">
            {hasSkuChoices ? (
              <Link className={available ? "button primary" : "button primary disabled"} href={`/produto/${product.slug}`}>
                Escolher
              </Link>
            ) : (
              <AddToCartButton
                analyticsItem={{
                  name: product.name,
                  brand: product.brand.name,
                  category: product.category.label,
                  priceCents: displayPrice
                }}
                slug={product.slug}
                label="Comprar"
                disabled={!available}
              />
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
