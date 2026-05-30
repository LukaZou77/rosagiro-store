import Link from "next/link";
import { AddToCartButton } from "@/components/AddToCartButton";
import type { CatalogProduct } from "@/lib/catalog";
import { money } from "@/lib/money";

export function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <article className="product-card">
      <Link href={`/produto/${product.slug}`} className="product-image">
        <img src={product.image} alt={product.name} loading="lazy" />
      </Link>
      <div className="product-card-body">
        <span>{product.brand.name}</span>
        <Link href={`/produto/${product.slug}`}>
          <h3>{product.name}</h3>
        </Link>
        <p>{product.subcategory}</p>
        <div className="product-card-bottom">
          <strong>{money(product.priceCents)}</strong>
          <AddToCartButton slug={product.slug} />
        </div>
      </div>
    </article>
  );
}
