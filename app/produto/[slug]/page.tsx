import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { CartCompletionRecommendations } from "@/components/CartCompletionRecommendations";
import { ProductCard } from "@/components/ProductCard";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductSkuSelector } from "@/components/ProductSkuSelector";
import { StoreShell } from "@/components/StoreShell";
import { StoreTrustSignals } from "@/components/StoreTrustSignals";
import { StructuredData } from "@/components/StructuredData";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { getCartCompletionRecommendations } from "@/lib/cart-completion";
import { getCategories, getProduct, getProducts, getRelatedProducts } from "@/lib/catalog";
import { customerDisplayText } from "@/lib/display-text";
import { money } from "@/lib/money";
import { effectiveSkuPriceCents, lowestEffectivePriceCents, hasSkuPriceRange } from "@/lib/product-pricing";
import { productDetailGalleryState, productDetailServiceCards } from "@/lib/product-detail-standard";
import { productHasActiveSkus, productQuantity, productStockLabel, productStockTone } from "@/lib/product-conversion";
import { normalizeProductGallery } from "@/lib/product-import-shared";
import { productWholesaleLines } from "@/lib/product-wholesale";
import { breadcrumbJsonLd, noIndexMetadata, productJsonLd, productMetaDescription, storefrontMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";
import { getStoreProfile, storeTrustSignals } from "@/lib/store-profile";
import { buildProductWhatsAppHref } from "@/lib/whatsapp";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product || !product.active) {
    return noIndexMetadata("Produto", "Produto RosaGiro indisponível.");
  }

  return storefrontMetadata({
    title: `${product.name} | ${product.brand.name}`,
    description: productMetaDescription(product),
    path: `/produto/${product.slug}`,
    image: product.image
  });
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product || !product.active) notFound();

  const [categories, related, storeProfile, products] = await Promise.all([
    getCategories(),
    getRelatedProducts(product.category.slug, product.slug),
    getStoreProfile(),
    getProducts()
  ]);
  const quantity = productQuantity(product);
  const available = quantity > 0;
  const stockLabel = productStockLabel(product);
  const stockTone = productStockTone(product);
  const activeSkus = product.skus.filter((sku) => sku.active).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const hasSkuChoices = productHasActiveSkus(product);
  const displayPrice = lowestEffectivePriceCents(product);
  const showFromPrice = hasSkuPriceRange(product);
  const whatsappHref = buildProductWhatsAppHref(product, storeProfile.whatsapp);
  const trustSignals = storeTrustSignals(storeProfile);
  const gallery = normalizeProductGallery(product.image, product.gallery);
  const galleryState = productDetailGalleryState(gallery);
  const serviceCards = productDetailServiceCards();
  const wholesaleLines = productWholesaleLines(product);
  const completionRecommendations = getCartCompletionRecommendations(products, [{ slug: product.slug, quantity: 1 }], {
    currentCategorySlug: product.category.slug,
    excludeSlug: product.slug,
    limit: 4
  });

  return (
    <StoreShell categories={categories}>
      <StructuredData
        data={[
          productJsonLd(product),
          breadcrumbJsonLd([
            { name: "Início", path: "/" },
            { name: product.category.label, path: `/categoria/${product.category.slug}` },
            { name: product.name, path: `/produto/${product.slug}` }
          ])
        ]}
      />
      <section className="product-detail">
        <div className="product-media">
          <ProductGallery images={gallery} productName={product.name} />
          <div className="product-media-standard">
            <strong>{galleryState.label}</strong>
            <span>{galleryState.isRich ? siteConfig.productConversion.galleryRichHint : siteConfig.productConversion.galleryLeanHint}</span>
          </div>
        </div>
        <div className="product-info">
          <Link className="back-link" href={`/categoria/${product.category.slug}`}>
            Voltar para {product.category.label}
          </Link>
          <p className="eyebrow">
            {product.brand.name} / {product.subcategory}
          </p>
          <h1>{product.name}</h1>
          <p className="description">{product.descriptionPt}</p>
          <div className="price-line">
            <strong>{showFromPrice ? `A partir de ${money(displayPrice)}` : money(displayPrice)}</strong>
          </div>
          <div className={`purchase-panel ${available ? "" : "is-unavailable"}`}>
            <div className="purchase-panel-heading">
              <span>{siteConfig.productConversion.detailPanelTitle}</span>
              <strong className={`stock-text ${stockTone}`}>{stockLabel}</strong>
            </div>
            <div className="purchase-metrics" aria-label="Resumo de compra">
              <div>
                <span>{siteConfig.productConversion.minimumLabel}</span>
                <strong>{money(siteConfig.wholesale.minimumOrderCents)}</strong>
                <small>{siteConfig.productConversion.minimumNote}</small>
              </div>
              <div>
                <span>{siteConfig.productConversion.freightLabel}</span>
                <strong>{siteConfig.productConversion.freightText}</strong>
              </div>
            </div>
            <p>{siteConfig.productConversion.detailPanelNote}</p>
            {hasSkuChoices ? (
              <ProductSkuSelector
                productSlug={product.slug}
                skus={activeSkus.map((sku) => ({ ...sku, priceCents: effectiveSkuPriceCents(product, sku) }))}
              />
            ) : null}
            <div className="purchase-panel-actions">
              {hasSkuChoices ? null : <AddToCartButton slug={product.slug} label="Adicionar ao carrinho" disabled={!available} wide />}
              <WhatsAppLink href={whatsappHref} className="button whatsapp">
                {siteConfig.whatsapp.productCta}
              </WhatsAppLink>
              <small>{siteConfig.productConversion.bundlePrompt}</small>
            </div>
          </div>
          <div className="badge-row">{product.badges.map((badge) => <span key={badge}>{customerDisplayText(badge)}</span>)}</div>
          <StoreTrustSignals signals={trustSignals} compact />
        </div>
      </section>

      <div className="mobile-product-action-bar" aria-label="Compra rápida do produto">
        <div>
          <span>{stockLabel}</span>
          <strong>{showFromPrice ? `A partir de ${money(displayPrice)}` : money(displayPrice)}</strong>
        </div>
        {hasSkuChoices ? (
          <a className="button primary" href="#sku-selector-title">
            Escolher
          </a>
        ) : (
          <AddToCartButton slug={product.slug} label={siteConfig.mobilePurchase.productCta} disabled={!available} />
        )}
        <WhatsAppLink href={whatsappHref} className="mobile-product-whatsapp">
          {siteConfig.mobilePurchase.productWhatsAppCta}
        </WhatsAppLink>
      </div>

      <section className="section wholesale-info-panel product-wholesale-detail" aria-labelledby="wholesale-info-title">
        <div className="section-heading compact">
          <p className="eyebrow">{siteConfig.productConversion.wholesaleInfoEyebrow}</p>
          <h2 id="wholesale-info-title">{siteConfig.productConversion.wholesaleInfoTitle}</h2>
          <p>{siteConfig.productConversion.wholesaleInfoNote}</p>
        </div>
        <div className="wholesale-info-grid">
          {wholesaleLines.map((line) => (
            <div className={line.fallback ? "is-fallback" : ""} key={line.key}>
              <span>{line.label}</span>
              <strong>{line.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section product-service-standard">
        <div className="section-heading">
          <p className="eyebrow">Suporte de compra</p>
          <h2>{siteConfig.productConversion.deliveryTitle}</h2>
          <p>{siteConfig.productConversion.deliveryBody}</p>
        </div>
        <div className="product-service-grid">
          {serviceCards.map((card) => (
            <div className={`product-service-card ${card.tone}`} key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        {completionRecommendations.length ? (
          <CartCompletionRecommendations
            recommendations={completionRecommendations}
            openDrawerOnAdd
            title={siteConfig.productConversion.completionTitle}
            body={`Combine ${product.name} com itens em estoque para aproximar sua lista do pedido mínimo.`}
          />
        ) : (
          <>
            <div className="section-heading">
              <p className="eyebrow">Completar pedido</p>
              <h2>Tambem nesta categoria</h2>
            </div>
            <div className="product-grid compact">
              {related.map((item) => (
                <ProductCard product={item} whatsappPhone={storeProfile.whatsapp} key={item.slug} />
              ))}
            </div>
          </>
        )}
      </section>
    </StoreShell>
  );
}
