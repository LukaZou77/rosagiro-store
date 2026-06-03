import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductCard } from "@/components/ProductCard";
import { ProductGallery } from "@/components/ProductGallery";
import { StoreShell } from "@/components/StoreShell";
import { StoreTrustSignals } from "@/components/StoreTrustSignals";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { getCategories, getProduct, getRelatedProducts } from "@/lib/catalog";
import { money } from "@/lib/money";
import { productDiscountPercent, productQuantity, productStockLabel, productStockTone } from "@/lib/product-conversion";
import { normalizeProductGallery } from "@/lib/product-import-shared";
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

  const [categories, related, storeProfile] = await Promise.all([
    getCategories(),
    getRelatedProducts(product.category.slug, product.slug),
    getStoreProfile()
  ]);
  const quantity = productQuantity(product);
  const available = quantity > 0;
  const stockLabel = productStockLabel(product);
  const stockTone = productStockTone(product);
  const discount = productDiscountPercent(product);
  const whatsappHref = buildProductWhatsAppHref(product);
  const trustSignals = storeTrustSignals(storeProfile);
  const gallery = normalizeProductGallery(product.image, product.gallery);

  return (
    <StoreShell categories={categories}>
      <section className="product-detail">
        <div className="product-media">
          <ProductGallery images={gallery} productName={product.name} />
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
          <dl className="spec-list">
            <div>
              <dt>Tipo</dt>
              <dd>{product.skinType}</dd>
            </div>
            <div>
              <dt>Acabamento</dt>
              <dd>{product.finish}</dd>
            </div>
            <div>
              <dt>Volume</dt>
              <dd>{product.volume}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{stockLabel}</dd>
            </div>
          </dl>
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

      <section className="section detail-columns">
        <div>
          <h2>Beneficios</h2>
          <ul>{product.benefits.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <h2>Ingredientes-chave</h2>
          <ul>{product.ingredients.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Complete a rotina</p>
          <h2>Tambem nesta categoria</h2>
        </div>
        <div className="product-grid compact">
          {related.map((item) => (
            <ProductCard product={item} key={item.slug} />
          ))}
        </div>
      </section>
    </StoreShell>
  );
}
