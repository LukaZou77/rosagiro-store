import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { StoreShell } from "@/components/StoreShell";
import { getCategories, getProducts } from "@/lib/catalog";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] : input;
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const [{ slug }, queryParams] = await Promise.all([params, searchParams]);
  const categorySlug = slug || "all";
  const brand = value(queryParams.brand) || "all";
  const query = value(queryParams.q) || "";
  const sort = value(queryParams.sort) || "featured";
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ categorySlug, brandName: brand, query, sort })
  ]);
  const currentCategory = categories.find((category) => category.slug === categorySlug);

  return (
    <StoreShell categories={categories}>
      <section className="catalog-header">
        <p className="eyebrow">Catalogo</p>
        <h1>{categorySlug === "all" ? "Todas as categorias" : currentCategory?.label || "Categoria"}</h1>
        <p>{products.length} produtos disponiveis, com filtros por categoria, marca e prioridade de compra.</p>
      </section>

      <section className="catalog-layout">
        <form className="filters" action={`/categoria/${categorySlug}`}>
          <label>
            Buscar
            <input name="q" defaultValue={query} placeholder="Serum, batom, perfume..." />
          </label>
          <label>
            Marca
            <select name="brand" defaultValue={brand}>
              <option value="all">Todas</option>
              {[...new Set(products.map((product) => product.brand.name))]
                .sort()
                .map((brandName) => (
                  <option value={brandName} key={brandName}>
                    {brandName}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Ordenar
            <select name="sort" defaultValue={sort}>
              <option value="featured">Curadoria</option>
              <option value="price-asc">Menor preco</option>
              <option value="price-desc">Maior preco</option>
              <option value="rating">Melhor avaliacao</option>
            </select>
          </label>
          <button className="button primary wide" type="submit">
            Aplicar filtros
          </button>
        </form>
        <div>
          <div className="category-pills">
            <Link className={categorySlug === "all" ? "active" : ""} href="/categoria/all">
              Tudo
            </Link>
            {categories.map((category) => (
              <Link
                className={categorySlug === category.slug ? "active" : ""}
                href={`/categoria/${category.slug}`}
                key={category.slug}
              >
                {category.label}
              </Link>
            ))}
          </div>
          <div className="product-grid">
            {products.length ? (
              products.map((product) => <ProductCard product={product} key={product.slug} />)
            ) : (
              <div className="empty-state">
                <strong>Nenhum produto encontrado</strong>
                <p>Tente limpar filtros ou buscar outro termo.</p>
                <Link className="button secondary" href="/categoria/all">
                  Explorar catalogo
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </StoreShell>
  );
}
