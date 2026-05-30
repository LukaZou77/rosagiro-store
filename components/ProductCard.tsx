import Link from "next/link";
import { AddToCartButton } from "@/components/AddToCartButton";
import type { CatalogProduct } from "@/lib/catalog";
import { money } from "@/lib/money";

export function ProductCard({ product }: { product: CatalogProduct }) {
  const quantity = product.inventory?.quantity || 0;
  const available = quantity > 0;
  const discount =
    product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents
      ? Math.round((1 - product.priceCents / product.compareAtPriceCents) * 100)
      : null;
  const heroBadge = discount ? `${discount}% OFF` : product.badges[0] || product.stockStatus;

  return (
    <article className={available ? "product-card" : "product-card is-unavailable"}>
      <Link href={`/produto/${product.slug}`} className="product-image">
        <span className="product-badge">{heroBadge}</span>
        <img src={product.image} alt={product.name} loading="lazy" />
      </Link>
      <div className="product-card-body">
        <div className="product-meta-line">
          <span>{product.brand.name}</span>
          <small className={available ? "stock-chip" : "stock-chip low"}>{available ? `${quantity} un.` : "Esgotado"}</small>
        </div>
        <Link href={`/produto/${product.slug}`}>
          <h3>{product.name}</h3>
        </Link>
        <p>{product.subcategory}</p>
        {product.badges.length ? (
          <div className="mini-badge-row">
            {product.badges.slice(0, 2).map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>
        ) : null}
        <div className="product-card-bottom">
          <div className="price-stack">
            <strong>{money(product.priceCents)}</strong>
            {product.compareAtPriceCents ? <span>{money(product.compareAtPriceCents)}</span> : <small>{product.stockStatus}</small>}
          </div>
          <AddToCartButton slug={product.slug} label="Comprar" disabled={!available} />
        </div>
      </div>
    </article>
  );
}
