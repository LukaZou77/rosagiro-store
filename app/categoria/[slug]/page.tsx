import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { StoreShell } from "@/components/StoreShell";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { getCategories, getProducts } from "@/lib/catalog";
import { productDiscountPercent, productQuantity } from "@/lib/product-conversion";
import { siteConfig } from "@/lib/site-config";
import { buildCatalogWhatsAppHref } from "@/lib/whatsapp";

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
  const categoryLabel = categorySlug === "all" ? "Todas as categorias" : currentCategory?.label || "Categoria";
  const whatsappHref = buildCatalogWhatsAppHref(categoryLabel, products.length);
  const readyCount = products.filter((product) => productQuantity(product) > 0).length;
  const dealCount = products.filter((product) => productDiscountPercent(product) > 0).length;
  const lowStockCount = products.filter((product) => {
    const quantity = productQuantity(product);
    return quantity > 0 && quantity <= 6;
  }).length;

  return (
    <StoreShell categories={categories}>
      <section className="catalog-header">
        <p className="eyebrow">Catalogo</p>
        <h1>{categoryLabel}</h1>
        <p>{products.length} produtos disponiveis, com filtros por categoria, marca e prioridade de compra.</p>
        <div className="catalog-service-bar">
          <span>{siteConfig.wholesale.minimumOrderText}</span>
          <span>{siteConfig.wholesale.deliveryModes[1]}</span>
          <WhatsAppLink href={whatsappHref} className="service-whatsapp">
            {siteConfig.whatsapp.serviceLabel}
          </WhatsAppLink>
        </div>
        <div className="catalog-kpis" aria-label="Resumo de compra da categoria">
          <span>
            <strong>{readyCount}</strong>
            Pronta entrega
          </span>
          <span>
            <strong>{dealCount}</strong>
            Desconto real
          </span>
          <span>
            <strong>{lowStockCount}</strong>
            Giro rapido
          </span>
          <span>
            <strong>{siteConfig.productConversion.cardMinimumHint}</strong>
            Compra minima
          </span>
        </div>
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
              <option value="featured">Destaque</option>
              <option value="price-asc">Menor preco</option>
              <option value="price-desc">Maior preco</option>
              <option value="name-asc">A-Z</option>
              <option value="name-desc">Z-A</option>
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
