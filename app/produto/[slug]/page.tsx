import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { CartCompletionRecommendations } from "@/components/CartCompletionRecommendations";
import { ProductCard } from "@/components/ProductCard";
import { ProductAnalyticsTracker } from "@/components/ProductAnalyticsTracker";
import { ProductGallery } from "@/components/ProductGallery";
import { StoreShell } from "@/components/StoreShell";
import { StoreTrustSignals } from "@/components/StoreTrustSignals";
import { StructuredData } from "@/components/StructuredData";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { getCartCompletionRecommendations } from "@/lib/cart-completion";
import { getCategories, getProduct, getRecommendationProducts, getRelatedProducts } from "@/lib/catalog";
import { customerDisplayText } from "@/lib/display-text";
import { money } from "@/lib/money";
import { productDetailGalleryState, productDetailServiceCards } from "@/lib/product-detail-standard";
import { productQuantity, productStockLabel, productStockTone } from "@/lib/product-conversion";
import { normalizeProductGallery } from "@/lib/product-import-shared";
import {
  productCommercialSummary,
  productEditorialDescription,
  productWholesalePackagePieces,
  productWholesaleLines
} from "@/lib/product-wholesale";
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

async function ProductRecommendations({
  categorySlug,
  productName,
  productSlug,
  whatsappPhone
}: {
  categorySlug: string;
  productName: string;
  productSlug: string;
  whatsappPhone: string;
}) {
  const recommendationProducts = await getRecommendationProducts({ categorySlug, excludeSlug: productSlug, take: 32 });
  const completionRecommendations = getCartCompletionRecommendations(
    recommendationProducts,
    [{ slug: productSlug, quantity: 1 }],
    {
      currentCategorySlug: categorySlug,
      excludeSlug: productSlug,
      limit: 4
    }
  );

  if (completionRecommendations.length) {
    return (
      <section className="section">
        <CartCompletionRecommendations
          recommendations={completionRecommendations}
          openDrawerOnAdd
          title={siteConfig.productConversion.completionTitle}
          body={`Combine ${productName} com itens em estoque para aproximar sua lista do pedido mínimo.`}
        />
      </section>
    );
  }

  const related = await getRelatedProducts(categorySlug, productSlug);
  return (
    <section className="section">
      <div className="section-heading">
        <p className="eyebrow">Completar pedido</p>
        <h2>Tambem nesta categoria</h2>
      </div>
      <div className="product-grid compact">
        {related.map((item) => (
          <ProductCard product={item} whatsappPhone={whatsappPhone} key={item.slug} />
        ))}
      </div>
    </section>
  );
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const [product, categories, storeProfile] = await Promise.all([getProduct(slug), getCategories(), getStoreProfile()]);
  if (!product || !product.active) notFound();

  const quantity = productQuantity(product);
  const available = quantity > 0;
  const stockLabel = productStockLabel(product);
  const stockTone = productStockTone(product);
  const activeSkus = product.skus.filter((sku) => sku.active).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const displayPrice = product.priceCents;
  const whatsappHref = buildProductWhatsAppHref(product, storeProfile.whatsapp);
  const trustSignals = storeTrustSignals(storeProfile);
  const skuImages = activeSkus.map((sku) => sku.image).filter((image): image is string => Boolean(image));
  const gallery = Array.from(new Set([...normalizeProductGallery(product.image, product.gallery), ...skuImages]));
  const galleryState = productDetailGalleryState(gallery);
  const serviceCards = productDetailServiceCards();
  const wholesaleLines = productWholesaleLines(product);
  const packagePieces = productWholesalePackagePieces(product);
  const packageOrderable = Boolean(packagePieces && quantity >= packagePieces);
  const editorialDescription = productEditorialDescription(product.descriptionPt);

  return (
    <StoreShell categories={categories}>
      <ProductAnalyticsTracker
        slug={product.slug}
        item={{
          name: product.name,
          brand: product.brand.name,
          category: product.category.label,
          priceCents: displayPrice
        }}
      />
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
            <Link className="product-brand-link" href={`/marcas/${product.brand.slug}`}>
              {product.brand.name}
            </Link>{" "}
            / {product.subcategory}
          </p>
          <h1>{product.name}</h1>
          <p className="description product-commercial-summary">{productCommercialSummary(product)}</p>
          {editorialDescription ? <p className="description product-editorial-description">{editorialDescription}</p> : null}
          <div className="price-line wholesale-price-line">
            <span>{siteConfig.productConversion.priceLabel}</span>
            <strong>{money(displayPrice)}</strong>
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
            <div className="fixed-package-note">
              <strong>Embalagem fechada do fabricante</strong>
              <span>As cores e variações vêm na composição original da embalagem. Não é possível escolher cores nem fracionar unidades.</span>
            </div>
            <div className="purchase-panel-actions">
              {packageOrderable && packagePieces ? (
                <AddToCartButton
                  analyticsItem={{
                    name: product.name,
                    brand: product.brand.name,
                    category: product.category.label,
                    priceCents: displayPrice
                  }}
                  slug={product.slug}
                  quantity={packagePieces}
                  label={`Adicionar 1 embalagem (${packagePieces} un.)`}
                  disabled={!available}
                  wide
                />
              ) : (
                <span className="button primary wide disabled" aria-disabled="true">
                  Embalagem sob consulta
                </span>
              )}
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

      <Suspense
        fallback={
          <section className="section product-recommendations-loading" aria-busy="true">
            <div className="section-heading">
              <p className="eyebrow">Completar pedido</p>
              <h2>Carregando sugestões...</h2>
            </div>
          </section>
        }
      >
        <ProductRecommendations
          categorySlug={product.category.slug}
          productName={product.name}
          productSlug={product.slug}
          whatsappPhone={storeProfile.whatsapp}
        />
      </Suspense>
    </StoreShell>
  );
}
