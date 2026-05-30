import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { StoreShell } from "@/components/StoreShell";
import { getCategories, getFeaturedBrands, getProducts } from "@/lib/catalog";
import { money } from "@/lib/money";
import { siteConfig } from "@/lib/site-config";

export default async function HomePage() {
  const [categories, brands, products] = await Promise.all([getCategories(), getFeaturedBrands(), getProducts()]);
  const heroProduct = products[0];

  return (
    <StoreShell categories={categories}>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{siteConfig.hero.eyebrow}</p>
          <h1>{siteConfig.hero.title}</h1>
          <p>{siteConfig.hero.body}</p>
          <div className="hero-actions">
            <Link className="button primary" href="/categoria/all">
              {siteConfig.hero.primaryCta}
            </Link>
            {heroProduct ? (
              <Link className="button secondary" href={`/produto/${heroProduct.slug}`}>
                {siteConfig.hero.secondaryCta}
              </Link>
            ) : null}
          </div>
        </div>
        {heroProduct ? (
          <Link className="hero-product" href={`/produto/${heroProduct.slug}`} aria-label="Produto em destaque">
            <img src={heroProduct.image} alt={heroProduct.name} />
            <span>{heroProduct.brand.name}</span>
            <strong>{heroProduct.name}</strong>
            <small>{money(heroProduct.priceCents)}</small>
          </Link>
        ) : null}
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

      <section className="section split-band">
        <div>
          <p className="eyebrow">{siteConfig.homeSections.brandsEyebrow}</p>
          <h2>{siteConfig.homeSections.brandsTitle}</h2>
        </div>
        <div className="brand-row">
          {brands.map((brand) => (
            <Link className="brand-chip" href={`/categoria/all?brand=${encodeURIComponent(brand.name)}`} key={brand.slug}>
              <span>{brand.logo}</span>
              <strong>{brand.name}</strong>
              <small>{brand.origin}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">{siteConfig.homeSections.featuredEyebrow}</p>
          <h2>{siteConfig.homeSections.featuredTitle}</h2>
        </div>
        <div className="product-grid">
          {products.slice(0, 8).map((product) => (
            <ProductCard product={product} key={product.slug} />
          ))}
        </div>
      </section>
    </StoreShell>
  );
}
