import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { StoreShell } from "@/components/StoreShell";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { discountPercent, getCategories, getPromotionCollections } from "@/lib/catalog";
import { customerDisplayText } from "@/lib/display-text";
import { money } from "@/lib/money";
import { productQuantity, productStockLabel } from "@/lib/product-conversion";
import { storefrontMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";
import { buildGeneralWhatsAppHref } from "@/lib/whatsapp";

export const metadata: Metadata = storefrontMetadata({
  title: "Promoções",
  description: "Ofertas, descontos reais e produtos de pronta entrega para compras de beleza no atacado.",
  path: "/promocoes"
});

export default async function PromotionsPage() {
  const [categories, collections] = await Promise.all([getCategories(), getPromotionCollections()]);
  const { products, dealProducts, lowPriceProducts, hotProducts, stockReadyProducts } = collections;
  const promo = siteConfig.promotionsPage;
  const whatsappHref = buildGeneralWhatsAppHref("promocoes");
  const heroProduct = dealProducts[0] || hotProducts[0] || lowPriceProducts[0] || products[0];
  const strongestDiscount = dealProducts.reduce((max, product) => Math.max(max, discountPercent(product)), 0);
  const readyStock = products.filter((product) => (product.inventory?.quantity || 0) > 0).length;
  const heroDiscount = heroProduct ? discountPercent(heroProduct) : 0;
  const heroStock = heroProduct ? productQuantity(heroProduct) : 0;

  return (
    <StoreShell categories={categories}>
      <section className="promo-route-hero">
        <div className="promo-route-copy">
          <p className="eyebrow">{promo.eyebrow}</p>
          <h1>{promo.title}</h1>
          <p>{promo.body}</p>
          <div className="wholesale-signal-row" aria-label="Sinais de promoção">
            {promo.signals.map((signal) => (
              <span key={signal}>{signal}</span>
            ))}
          </div>
          <div className="hero-actions">
            <Link className="button primary" href="#ofertas">
              {promo.primaryCta}
            </Link>
            <WhatsAppLink className="button whatsapp" href={whatsappHref}>
              {promo.secondaryCta}
            </WhatsAppLink>
          </div>
        </div>

        {heroProduct ? (
          <Link className="promo-route-feature" href={`/produto/${heroProduct.slug}`} aria-label={`Oferta destaque: ${heroProduct.name}`}>
            <span className="deal-label">{heroDiscount ? `${heroDiscount}% OFF` : promo.heroBadge}</span>
            <img src={heroProduct.image} alt={heroProduct.name} />
            <div>
              <span>{heroProduct.brand.name}</span>
              <strong>{heroProduct.name}</strong>
              <p>{heroProduct.subcategory}</p>
              <small className="promo-feature-stock">
                {heroStock > 0 ? `${heroStock} un. pronta entrega` : "Disponibilidade sob consulta"}
              </small>
              <div className="price-line compact">
                <strong>{money(heroProduct.priceCents)}</strong>
                {heroProduct.compareAtPriceCents ? <span>{money(heroProduct.compareAtPriceCents)}</span> : null}
              </div>
            </div>
          </Link>
        ) : null}

        <dl className="promo-route-stats">
          <div>
            <dt>{dealProducts.length}</dt>
            <dd>ofertas com desconto real</dd>
          </div>
          <div>
            <dt>{strongestDiscount || 0}%</dt>
            <dd>maior desconto exibido</dd>
          </div>
          <div>
            <dt>{readyStock}</dt>
            <dd>itens em pronta entrega</dd>
          </div>
        </dl>
      </section>

      <section className="section promo-ops-band">
        {promo.tiles.map((tile) => (
          <article key={tile.label}>
            <span>{tile.label}</span>
            <p>{tile.text}</p>
          </article>
        ))}
      </section>

      <section className="section" id="ofertas">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Ofertas</p>
            <h2>{promo.dealShelfTitle}</h2>
          </div>
          <p>{promo.dealShelfBody}</p>
        </div>
        <div className="product-grid">
          {dealProducts.length ? (
            dealProducts.map((product) => <ProductCard product={product} key={product.slug} />)
          ) : (
            <div className="empty-state">
              <h3>{promo.emptyDealTitle}</h3>
              <p>{promo.emptyDealBody}</p>
            </div>
          )}
        </div>
      </section>

      <section className="section promo-shelf-band">
        <div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Baixo ticket</p>
              <h2>{promo.lowPriceTitle}</h2>
            </div>
          </div>
          <div className="deal-list">
            {lowPriceProducts.length ? (
              lowPriceProducts.map((product) => (
                <Link href={`/produto/${product.slug}`} key={product.slug}>
                  <img src={product.image} alt={product.name} />
                  <span>
                    <strong>{product.name}</strong>
                    <small>{product.brand.name} / {productStockLabel(product)}</small>
                  </span>
                  <b>{money(product.priceCents)}</b>
                </Link>
              ))
            ) : (
              <div className="empty-state">
                <p>Nenhum produto em estoque para listar.</p>
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Giro rápido</p>
              <h2>{promo.hotShelfTitle}</h2>
            </div>
          </div>
          <div className="deal-list">
            {hotProducts.length ? (
              hotProducts.map((product) => (
                <Link href={`/produto/${product.slug}`} key={product.slug}>
                  <img src={product.image} alt={product.name} />
                  <span>
                    <strong>{product.name}</strong>
                    <small>{customerDisplayText(product.badges[0] || product.category.label)} / {productQuantity(product)} un.</small>
                  </span>
                  <b>{productQuantity(product) > 0 ? "Pronta entrega" : "Consultar"}</b>
                </Link>
              ))
            ) : (
              <div className="empty-state">
                <p>Nenhum item de giro rápido cadastrado ainda.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section shelf-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Estoque</p>
            <h2>{promo.stockShelfTitle}</h2>
          </div>
          <p>{promo.shelfNote}</p>
        </div>
        <div className="product-grid">
          {stockReadyProducts.length ? (
            stockReadyProducts.map((product) => <ProductCard product={product} key={product.slug} />)
          ) : (
            <div className="empty-state">
              <h3>{promo.emptyStockTitle}</h3>
              <p>{promo.emptyStockBody}</p>
            </div>
          )}
        </div>
      </section>
    </StoreShell>
  );
}
