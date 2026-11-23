import Link from "next/link";
import { AddToCartButton } from "@/components/AddToCartButton";
import { OptimizedProductImage } from "@/components/OptimizedProductImage";
import { shouldDisplayProductBrand } from "@/components/ProductBrandDisplay";
import buyingStyles from "@/components/ProductBuying.module.css";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import type { CatalogCardProduct } from "@/lib/catalog";
import { customerDisplayText } from "@/lib/display-text";
import { money } from "@/lib/money";
import {
  productWholesalePackageLabel,
  productWholesalePackagePieces,
  productWholesalePackagePriceCents
} from "@/lib/product-wholesale";
import {
  productQuantity,
  productShortStockLabel,
  productStockTone
} from "@/lib/product-conversion";
import { siteConfig } from "@/lib/site-config";
import { isSourceCatalogConsultationProduct, sourceCatalogPriceLabel } from "@/lib/source-catalog-product";
import { buildProductWhatsAppHref } from "@/lib/whatsapp";
import { wholesaleReferenceUnitPriceCents } from "@/lib/wholesale-order";

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

function productCardTags(product: CatalogCardProduct) {
  const tags = [product.category.label, product.subcategory].map(customerDisplayText).filter(Boolean);
  const seen = new Set<string>();

  return tags.filter((tag) => {
    const key = normalizedLabel(tag);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 2);
}

export function ProductCard({ product, whatsappPhone }: { product: CatalogCardProduct; whatsappPhone?: string | null }) {
  const quantity = productQuantity(product);
  const consultationOnly = isSourceCatalogConsultationProduct(product);
  const available = !consultationOnly && quantity > 0;
  const heroBadge = product.badges.map(customerDisplayText).find(isSpecialCardBadge) || "";
  const stockTone = productStockTone(product);
  const shortStockLabel = productShortStockLabel(product);
  const whatsappHref = buildProductWhatsAppHref(product, whatsappPhone);
  const infoTags = productCardTags(product);
  const packagePieces = productWholesalePackagePieces(product);
  const packagePriceCents = productWholesalePackagePriceCents(product);
  const packageOrderable = Boolean(!consultationOnly && packagePieces && quantity >= packagePieces && packagePriceCents);
  const displayPrice = !consultationOnly && packagePieces && packagePriceCents
    ? wholesaleReferenceUnitPriceCents(packagePriceCents, packagePieces)
    : product.priceCents;
  const showBrand = shouldDisplayProductBrand(product.brand.name);
  const priceLabel = consultationOnly
    ? sourceCatalogPriceLabel(product.wholesalePackage)
    : siteConfig.productConversion.priceLabel;

  return (
    <article className={consultationOnly ? "product-card is-consultation" : available ? "product-card" : "product-card is-unavailable"}>
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
          {showBrand ? <span>{product.brand.name}</span> : null}
          <small className={`stock-chip ${stockTone}`}>{shortStockLabel}</small>
        </div>
        <Link href={`/produto/${product.slug}`} className="product-card-title" title={product.name}>
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
          <div className={buyingStyles.cardPrice}>
            <div className={buyingStyles.cardUnitPrice}>
              <strong>{money(displayPrice)}</strong>
              <span>{!consultationOnly && packagePieces && packagePriceCents ? "/ un. (aprox.)" : priceLabel}</span>
            </div>
            <small>
              {!consultationOnly && packagePieces && packagePriceCents
                ? `${packagePieces} ${packagePieces === 1 ? "unidade" : "unidades"} · ${money(packagePriceCents)} por embalagem`
                : productWholesalePackageLabel(product)}
            </small>
          </div>
          <div className="product-card-actions">
            {consultationOnly ? (
              <button type="button" disabled>
                Estoque sob consulta
              </button>
            ) : !packagePieces || !packagePriceCents ? (
              <Link className="button secondary" href={`/produto/${product.slug}`}>
                Consultar embalagem
              </Link>
            ) : !packageOrderable ? (
              <button type="button" disabled>
                Sem embalagem completa
              </button>
            ) : (
              <AddToCartButton
                analyticsItem={{
                  name: product.name,
                  brand: product.brand.name,
                  category: product.category.label,
                  priceCents: displayPrice
                }}
                slug={product.slug}
                quantity={packagePieces}
                stockQuantity={quantity}
                label="Adicionar 1 embalagem"
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
