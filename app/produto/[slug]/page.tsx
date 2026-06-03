import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { CartCompletionRecommendations } from "@/components/CartCompletionRecommendations";
import { ProductCard } from "@/components/ProductCard";
import { ProductGallery } from "@/components/ProductGallery";
import { StoreShell } from "@/components/StoreShell";
import { StoreTrustSignals } from "@/components/StoreTrustSignals";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { getCartCompletionRecommendations } from "@/lib/cart-completion";
import { getCategories, getProduct, getProducts, getRelatedProducts } from "@/lib/catalog";
import { money } from "@/lib/money";
import {
  productDetailGalleryState,
  productDetailInfoItems,
  productDetailServiceCards
} from "@/lib/product-detail-standard";
import { productDiscountPercent, productQuantity, productStockLabel, productStockTone } from "@/lib/product-conversion";
import { normalizeProductGallery } from "@/lib/product-import-shared";
import { productWholesaleLines } from "@/lib/product-wholesale";
import { siteConfig } from "@/lib/site-config";
import { getStoreProfile, storeTrustSignals } from "@/lib/store-profile";
import { buildProductWhatsAppHref } from "@/lib/whatsapp";

type PageProps = {
  params: Promise<{ slug: string }>;
};

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
  const discount = productDiscountPercent(product);
  const whatsappHref = buildProductWhatsAppHref(product);
  const trustSignals = storeTrustSignals(storeProfile);
  const gallery = normalizeProductGallery(product.image, product.gallery);
  const galleryState = productDetailGalleryState(gallery);
  const detailInfoItems = productDetailInfoItems(product);
  const serviceCards = productDetailServiceCards();
  const wholesaleLines = productWholesaleLines(product);
  const completionRecommendations = getCartCompletionRecommendations(products, [{ slug: product.slug, quantity: 1 }], {
    currentCategorySlug: product.category.slug,
    excludeSlug: product.slug,
    limit: 4
  });

  return (
    <StoreShell categories={categories}>
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
          <div className="rating">{siteConfig.productConversion.reviewFallback}</div>
          <p className="description">{product.descriptionPt}</p>
          <div className="price-line">
            <strong>{money(product.priceCents)}</strong>
            {product.compareAtPriceCents ? <span>{money(product.compareAtPriceCents)}</span> : null}
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
              </div>
              <div>
                <span>{siteConfig.productConversion.stockLabel}</span>
                <strong>{available ? `${quantity} un.` : "Sob consulta"}</strong>
              </div>
              <div>
                <span>{siteConfig.productConversion.freightLabel}</span>
                <strong>{siteConfig.productConversion.freightText}</strong>
              </div>
            </div>
            <p>{discount > 0 ? `${discount}% OFF com preco comparativo cadastrado. ` : ""}{siteConfig.productConversion.detailPanelNote}</p>
            <div className="purchase-panel-actions">
              <AddToCartButton slug={product.slug} label="Adicionar ao carrinho" disabled={!available} wide />
              <WhatsAppLink href={whatsappHref} className="button whatsapp">
                {siteConfig.whatsapp.productCta}
              </WhatsAppLink>
              <small>{siteConfig.productConversion.bundlePrompt}</small>
            </div>
          </div>
          <div className="badge-row">{product.badges.map((badge) => <span key={badge}>{badge}</span>)}</div>
          <StoreTrustSignals signals={trustSignals} compact />
        </div>
      </section>

      <div className="mobile-product-action-bar" aria-label="Compra rapida do produto">
        <div>
          <span>{stockLabel}</span>
          <strong>{money(product.priceCents)}</strong>
        </div>
        <AddToCartButton slug={product.slug} label={siteConfig.mobilePurchase.productCta} disabled={!available} />
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

      <section className="section product-realness-sections">
        <div className="product-realness-card product-ficha-card">
          <div className="section-heading compact">
            <p className="eyebrow">Ficha comercial</p>
            <h2>{siteConfig.productConversion.fichaTitle}</h2>
            <p>{siteConfig.productConversion.fichaBody}</p>
          </div>
          <dl className="product-ficha-list">
            {detailInfoItems.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="product-realness-card">
          <div className="section-heading compact">
            <p className="eyebrow">Uso e composicao</p>
            <h2>Beneficios</h2>
          </div>
          <ul>{product.benefits.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div className="product-realness-card">
          <div className="section-heading compact">
            <p className="eyebrow">Composicao</p>
            <h2>Ingredientes-chave</h2>
          </div>
          <ul>{product.ingredients.map((item) => <li key={item}>{item}</li>)}</ul>
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
            body={`Combine ${product.name} com itens em estoque para aproximar sua lista do pedido minimo.`}
          />
        ) : (
          <>
            <div className="section-heading">
              <p className="eyebrow">Completar pedido</p>
              <h2>Tambem nesta categoria</h2>
            </div>
            <div className="product-grid compact">
              {related.map((item) => (
                <ProductCard product={item} key={item.slug} />
              ))}
            </div>
          </>
        )}
      </section>
    </StoreShell>
  );
}
