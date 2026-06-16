import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { StoreShell } from "@/components/StoreShell";
import { StoreTrustSignals } from "@/components/StoreTrustSignals";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { getCategories, getFeaturedBrands, getProducts } from "@/lib/catalog";
import { money } from "@/lib/money";
import { hasSkuPriceRange, lowestEffectivePriceCents } from "@/lib/product-pricing";
import { siteConfig } from "@/lib/site-config";
import { getStoreProfile, storeTrustSignals } from "@/lib/store-profile";
import { buildGeneralWhatsAppHref } from "@/lib/whatsapp";

function discountLabel(product: Awaited<ReturnType<typeof getProducts>>[number]) {
  if (!product.compareAtPriceCents || product.compareAtPriceCents <= product.priceCents) return product.badges[0] || "Destaque";
  const discount = Math.round((1 - product.priceCents / product.compareAtPriceCents) * 100);
  return `${discount}% OFF`;
}

function displayPriceLabel(product: Awaited<ReturnType<typeof getProducts>>[number]) {
  const price = money(lowestEffectivePriceCents(product));
  return hasSkuPriceRange(product) ? `A partir de ${price}` : price;
}

export default async function HomePage() {
  const [categories, brands, products, storeProfile] = await Promise.all([
    getCategories(),
    getFeaturedBrands(),
    getProducts(),
    getStoreProfile()
  ]);
  const dealProducts = products.filter((product) => product.compareAtPriceCents).slice(0, 3);
  const heroProduct = dealProducts[0] || products[0];
  const secondaryDeals = (dealProducts.length > 1 ? dealProducts.slice(1) : products.filter((product) => product.slug !== heroProduct?.slug)).slice(0, 2);
  const whatsappHref = buildGeneralWhatsAppHref("home atacado", storeProfile.whatsapp);
  const homeTrustSignals = Array.from(
    new Set([
      ...storeTrustSignals(storeProfile, 3),
      "Pix e cartão no checkout",
      "Retirada ou envio por CEP",
      "Trocas e políticas visíveis"
    ])
  ).slice(0, 5);
  const stats = [
    { value: `${products.length}+`, label: siteConfig.homePromotions.stats.productsLabel },
    { value: `${categories.length}`, label: siteConfig.homePromotions.stats.categoriesLabel },
    { value: `${brands.length}+`, label: siteConfig.homePromotions.stats.brandsLabel }
  ];

  return (
    <StoreShell categories={categories}>
      <section className="promo-strip" aria-label="Campanha atual">
        <span>{siteConfig.homePromotions.promoBar.label}</span>
        <p>{siteConfig.homePromotions.promoBar.text}</p>
        <Link href={siteConfig.homePromotions.promoBar.href}>{siteConfig.homePromotions.promoBar.cta}</Link>
      </section>

      <section className="hero promo-hero">
        <div className="hero-copy">
          <p className="eyebrow">{siteConfig.hero.eyebrow}</p>
          <h1>{siteConfig.hero.title}</h1>
          <p>{siteConfig.hero.body}</p>
          <div className="wholesale-signal-row" aria-label="Sinais de compra no atacado">
            {siteConfig.wholesale.shelfSignals.map((signal) => (
              <span key={signal}>{signal}</span>
            ))}
          </div>
        </div>
        <div className="hero-commerce-panel" aria-label="Ofertas em destaque">
          <div className="panel-heading">
            <p className="eyebrow">Em estoque</p>
            <strong>Ofertas e campeões de venda</strong>
          </div>
          {heroProduct ? (
            <Link className="hero-product" href={`/produto/${heroProduct.slug}`} aria-label="Produto em destaque">
              <span className="deal-label">{discountLabel(heroProduct)}</span>
              <img src={heroProduct.image} alt={heroProduct.name} />
              <span>{heroProduct.brand.name}</span>
              <strong>{heroProduct.name}</strong>
              <small>{displayPriceLabel(heroProduct)}</small>
            </Link>
          ) : null}
          <div className="deal-list">
            {secondaryDeals.map((product) => (
              <Link href={`/produto/${product.slug}`} key={product.slug}>
                <img src={product.image} alt={product.name} />
                <span>
                  <strong>{product.name}</strong>
                  <small>{product.brand.name}</small>
                </span>
                <b>{displayPriceLabel(product)}</b>
              </Link>
            ))}
          </div>
        </div>
        <div className="hero-shop-actions">
          <form className="home-search" action="/categoria/all">
            <label htmlFor="home-search-input">Buscar no catálogo</label>
            <div>
              <input id="home-search-input" name="q" placeholder={siteConfig.homePromotions.searchPlaceholder} />
              <button className="button primary" type="submit">
                Buscar
              </button>
            </div>
          </form>
          <div className="hero-actions">
            <Link className="button primary" href="/categoria/all">
              {siteConfig.hero.primaryCta}
            </Link>
            <Link className="button secondary" href="/promocoes">
              Ver promoções
            </Link>
            {heroProduct ? (
              <Link className="button secondary" href={`/produto/${heroProduct.slug}`}>
                {siteConfig.hero.secondaryCta}
              </Link>
            ) : null}
          </div>
        </div>
        <dl className="hero-stats">
          {stats.map((item) => (
            <div key={item.label}>
              <dt>{item.value}</dt>
              <dd>{item.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="home-trust-section" aria-label="Loja confiável">
        <StoreTrustSignals
          signals={homeTrustSignals}
          title="Dados da loja, atendimento humano e compra acompanhada"
          body="Veja os canais oficiais, políticas, entrega e formas de atendimento antes de montar seu pedido."
        />
        <div className="home-trust-shortcuts">
          <Link href="/informacoes-da-loja">Dados da loja</Link>
          <Link href="/entrega">Entrega e retirada</Link>
          <Link href="/trocas-e-devolucoes">Trocas</Link>
          <WhatsAppLink href={whatsappHref}>WhatsApp</WhatsAppLink>
        </div>
      </section>

      <section className="section quick-action-section">
        <div className="quick-action-grid">
          {siteConfig.homePromotions.quickActions.map((action) => (
            <Link className="quick-action" href={action.href} key={action.label}>
              <span>{action.label}</span>
              <small>{action.description}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">{siteConfig.homeSections.categoriesEyebrow}</p>
          <h2>{siteConfig.homeSections.categoriesTitle}</h2>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <Link className="category-tile" href={`/categoria/${category.slug}`} key={category.slug}>
              <span>{category.label}</span>
              <small>{category.note}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="section wholesale-band">
        <div>
          <p className="eyebrow">{siteConfig.homePromotions.wholesaleBand.eyebrow}</p>
          <h2>{siteConfig.homePromotions.wholesaleBand.title}</h2>
          <p>{siteConfig.homePromotions.wholesaleBand.body}</p>
          <div className="hero-actions">
            <Link className="button primary" href="/categoria/all">
              {siteConfig.homePromotions.wholesaleBand.primaryCta}
            </Link>
            <WhatsAppLink className="button whatsapp" href={whatsappHref}>
              {siteConfig.homePromotions.wholesaleBand.secondaryCta}
            </WhatsAppLink>
          </div>
        </div>
        <ul className="service-list">
          {siteConfig.homePromotions.trustPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
          {siteConfig.wholesale.deliveryModes.map((mode) => (
            <li key={mode}>{mode}</li>
          ))}
        </ul>
      </section>

      <section className="section split-band brand-market">
        <div>
          <p className="eyebrow">{siteConfig.homeSections.brandsEyebrow}</p>
          <h2>{siteConfig.homeSections.brandsTitle}</h2>
        </div>
        <div className="brand-row">
          {brands.map((brand) => (
            <Link className="brand-chip" href={`/categoria/all?brand=${encodeURIComponent(brand.name)}`} key={brand.slug}>
              <span>{brand.logo}</span>
              <strong>{brand.name}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="section shelf-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{siteConfig.homeSections.featuredEyebrow}</p>
            <h2>{siteConfig.homeSections.featuredTitle}</h2>
          </div>
          <p>{siteConfig.homePromotions.shelfNote}</p>
        </div>
        <div className="product-grid">
          {products.slice(0, 8).map((product) => (
            <ProductCard product={product} whatsappPhone={storeProfile.whatsapp} key={product.slug} />
          ))}
        </div>
      </section>
    </StoreShell>
  );
}
