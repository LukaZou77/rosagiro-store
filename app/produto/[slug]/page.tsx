import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductCard } from "@/components/ProductCard";
import { StoreShell } from "@/components/StoreShell";
import { getCategories, getProduct, getRelatedProducts } from "@/lib/catalog";
import { money } from "@/lib/money";
import { siteConfig } from "@/lib/site-config";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product || !product.active) notFound();

  const [categories, related] = await Promise.all([getCategories(), getRelatedProducts(product.category.slug, product.slug)]);
  const available = (product.inventory?.quantity || 0) > 0;

  return (
    <StoreShell categories={categories}>
      <section className="product-detail">
        <div className="product-media">
          <img src={product.image} alt={product.name} />
        </div>
        <div className="product-info">
          <Link className="back-link" href={`/categoria/${product.category.slug}`}>
            Voltar para {product.category.label}
          </Link>
          <p className="eyebrow">
            {product.brand.name} / {product.subcategory}
          </p>
          <h1>{product.name}</h1>
          <div className="rating">
            Nota {product.rating.toFixed(1)} <span>({product.reviewCount} avaliacoes)</span>
          </div>
          <p className="description">{product.descriptionPt}</p>
          <div className="price-line">
            <strong>{money(product.priceCents)}</strong>
            {product.compareAtPriceCents ? <span>{money(product.compareAtPriceCents)}</span> : null}
          </div>
          <div className="purchase-panel">
            <div>
              <span>{siteConfig.wholesale.minimumOrderTitle}</span>
              <strong>{money(siteConfig.wholesale.minimumOrderCents)}</strong>
            </div>
            <p>{siteConfig.wholesale.minimumOrderText}</p>
            <a href={siteConfig.whatsappHref}>{siteConfig.wholesale.serviceLabel}</a>
          </div>
          <div className="badge-row">{product.badges.map((badge) => <span key={badge}>{badge}</span>)}</div>
          <AddToCartButton slug={product.slug} label="Adicionar ao carrinho" disabled={!available} wide />
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
              <dd>{available ? product.stockStatus : "Esgotado"}</dd>
            </div>
          </dl>
        </div>
      </section>

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
