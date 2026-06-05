import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { StoreShell } from "@/components/StoreShell";
import { StructuredData } from "@/components/StructuredData";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { getCategories, getProducts } from "@/lib/catalog";
import { productDiscountPercent, productQuantity } from "@/lib/product-conversion";
import { breadcrumbJsonLd, categoryMetaDescription, noIndexMetadata, storefrontMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";
import { buildCatalogWhatsAppHref } from "@/lib/whatsapp";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const sortLabels: Record<string, string> = {
  featured: "Destaque",
  "price-asc": "Menor preço",
  "price-desc": "Maior preço",
  "name-asc": "Alfabética (A-Z)",
  "name-desc": "Alfabética (Z-A)"
};

const stockLabels: Record<string, string> = {
  all: "Todos",
  ready: "Pronta entrega",
  low: "Giro rápido",
  out: "Esgotados"
};

const dealLabels: Record<string, string> = {
  all: "Todos",
  "real-deal": "Desconto real"
};

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] : input;
}

function safeSort(value: string) {
  return sortLabels[value] ? value : "featured";
}

function safeStock(value: string) {
  return stockLabels[value] ? value : "all";
}

function safeDeal(value: string) {
  return dealLabels[value] ? value : "all";
}

function catalogHref(categorySlug: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, item]) => {
    if (!item || item === "all" || (key === "sort" && item === "featured")) return;
    search.set(key, item);
  });
  const query = search.toString();
  return `/categoria/${categorySlug}${query ? `?${query}` : ""}`;
}

async function categorySeoContext(slug: string) {
  const [categories, products] = await Promise.all([getCategories(), getProducts({ categorySlug: slug })]);
  const currentCategory = categories.find((category) => category.slug === slug);
  const label = slug === "all" ? "Todas as categorias" : currentCategory?.label || "Categoria";
  return { categories, products, currentCategory, label };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const categorySlug = slug || "all";
  const { currentCategory, label, products } = await categorySeoContext(categorySlug);
  if (categorySlug !== "all" && !currentCategory) {
    return noIndexMetadata("Categoria", "Categoria RosaGiro indisponível.");
  }
  const path = `/categoria/${categorySlug}`;
  return storefrontMetadata({
    title: `${label} no atacado`,
    description: categoryMetaDescription(label, products.length),
    path
  });
}

function FilterFields({
  brand,
  brandOptions,
  dealFilter,
  query,
  sort,
  stockFilter
}: {
  brand: string;
  brandOptions: string[];
  dealFilter: string;
  query: string;
  sort: string;
  stockFilter: string;
}) {
  return (
    <>
      <label>
        Buscar
        <input name="q" defaultValue={query} placeholder="Serum, batom, perfume..." />
      </label>
      <label>
        Marca
        <select name="brand" defaultValue={brand}>
          <option value="all">Todas</option>
          {brandOptions.map((brandName) => (
            <option value={brandName} key={brandName}>
              {brandName}
            </option>
          ))}
        </select>
      </label>
      <label>
        Estoque
        <select name="stock" defaultValue={stockFilter}>
          <option value="all">Todos</option>
          <option value="ready">Pronta entrega</option>
          <option value="low">Giro rápido</option>
          <option value="out">Esgotados</option>
        </select>
      </label>
      <label>
        Oferta
        <select name="deal" defaultValue={dealFilter}>
          <option value="all">Todos</option>
          <option value="real-deal">Desconto real</option>
        </select>
      </label>
      <label>
        Ordenar
        <select name="sort" defaultValue={sort}>
          <option value="featured">Destaque</option>
          <option value="price-asc">Menor preço</option>
          <option value="price-desc">Maior preço</option>
          <option value="name-asc">Alfabética (A-Z)</option>
          <option value="name-desc">Alfabética (Z-A)</option>
        </select>
      </label>
      <button className="button primary wide" type="submit">
        Aplicar filtros
      </button>
    </>
  );
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const [{ slug }, queryParams] = await Promise.all([params, searchParams]);
  const categorySlug = slug || "all";
  const brand = value(queryParams.brand) || "all";
  const query = value(queryParams.q) || "";
  const sort = safeSort(value(queryParams.sort) || "featured");
  const stockFilter = safeStock(value(queryParams.stock) || "all");
  const dealFilter = safeDeal(value(queryParams.deal) || "all");
  const [categories, baseProducts, products] = await Promise.all([
    getCategories(),
    getProducts({ categorySlug }),
    getProducts({ categorySlug, brandName: brand, query, sort, stockFilter, dealFilter })
  ]);
  const currentCategory = categories.find((category) => category.slug === categorySlug);
  const categoryLabel = categorySlug === "all" ? "Todas as categorias" : currentCategory?.label || "Categoria";
  const whatsappHref = buildCatalogWhatsAppHref(categoryLabel, products.length);
  const brandOptions = [...new Set(baseProducts.map((product) => product.brand.name))].sort();
  const sortLabel = sortLabels[sort] || sortLabels.featured;
  const clearHref = catalogHref(categorySlug, {});
  const filterCount = [query ? "q" : "", brand !== "all" ? "brand" : "", stockFilter !== "all" ? "stock" : "", dealFilter !== "all" ? "deal" : ""].filter(Boolean).length;
  const activeFilters = [
    query ? { key: "q", label: `Busca: ${query}`, href: catalogHref(categorySlug, { brand, stock: stockFilter, deal: dealFilter, sort }) } : null,
    brand !== "all" ? { key: "brand", label: `Marca: ${brand}`, href: catalogHref(categorySlug, { q: query, stock: stockFilter, deal: dealFilter, sort }) } : null,
    stockFilter !== "all" ? { key: "stock", label: stockLabels[stockFilter], href: catalogHref(categorySlug, { q: query, brand, deal: dealFilter, sort }) } : null,
    dealFilter !== "all" ? { key: "deal", label: dealLabels[dealFilter], href: catalogHref(categorySlug, { q: query, brand, stock: stockFilter, sort }) } : null
  ].filter((item): item is { key: string; label: string; href: string } => Boolean(item));
  const readyCount = products.filter((product) => productQuantity(product) > 0).length;
  const dealCount = products.filter((product) => productDiscountPercent(product) > 0).length;
  const lowStockCount = products.filter((product) => {
    const quantity = productQuantity(product);
    return quantity > 0 && quantity <= 6;
  }).length;

  return (
    <StoreShell categories={categories}>
      <StructuredData
        data={breadcrumbJsonLd([
            { name: "Início", path: "/" },
          { name: "Catálogo", path: "/categoria/all" },
          { name: categoryLabel, path: `/categoria/${categorySlug}` }
        ])}
      />
      <section className="catalog-header">
        <p className="eyebrow">Catálogo</p>
        <h1>{categoryLabel}</h1>
        <p>{products.length} produtos disponíveis, com filtros por categoria, marca e prioridade de compra.</p>
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
            Giro rápido
          </span>
          <span>
            <strong>{siteConfig.productConversion.cardMinimumHint}</strong>
            Compra mínima
          </span>
        </div>
      </section>

      <section className="catalog-layout">
        <div className="catalog-filter-topbar" aria-label="Filtros e ordenação do catálogo">
          <details>
            <summary>
              <span>Filtrar</span>
              {filterCount ? <strong>{filterCount}</strong> : null}
            </summary>
            <div className="filter-drawer-panel">
              <div className="filter-drawer-heading">
                <div>
                  <span>Filtros</span>
                  <strong>Encontrar produto</strong>
                </div>
                <small>{products.length} produtos</small>
              </div>
              <p>{siteConfig.mobilePurchase.filterHint}</p>
              <form className="filters" action={`/categoria/${categorySlug}`}>
                <FilterFields brand={brand} brandOptions={brandOptions} dealFilter={dealFilter} query={query} sort={sort} stockFilter={stockFilter} />
                <Link className="button secondary wide" href={clearHref}>
                  Limpar
                </Link>
              </form>
            </div>
          </details>
          <form className="catalog-sort-form" action={`/categoria/${categorySlug}`}>
            <input type="hidden" name="q" value={query} />
            <input type="hidden" name="brand" value={brand} />
            <input type="hidden" name="stock" value={stockFilter} />
            <input type="hidden" name="deal" value={dealFilter} />
            <label>
              <span>Ordenar</span>
              <select name="sort" defaultValue={sort}>
                <option value="featured">Destaque</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
                <option value="name-asc">Alfabética (A-Z)</option>
                <option value="name-desc">Alfabética (Z-A)</option>
              </select>
            </label>
            <button className="button secondary" type="submit">
              Aplicar
            </button>
          </form>
        </div>
        <form className="filters desktop-filters" action={`/categoria/${categorySlug}`}>
          <FilterFields brand={brand} brandOptions={brandOptions} dealFilter={dealFilter} query={query} sort={sort} stockFilter={stockFilter} />
          <Link className="button secondary wide" href={clearHref}>
            Limpar filtros
          </Link>
        </form>
        <div>
          <div className="catalog-results-bar">
            <div>
              <strong>{products.length} produtos encontrados</strong>
              <span>Ordenado por {sortLabel}</span>
            </div>
            {activeFilters.length ? (
              <div className="active-filter-chips" aria-label="Filtros ativos">
                {activeFilters.map((filter) => (
                  <Link href={filter.href} key={filter.key}>
                    {filter.label} x
                  </Link>
                ))}
                <Link className="clear-all" href={clearHref}>
                  Limpar tudo
                </Link>
              </div>
            ) : (
              <span className="catalog-result-hint">Use filtros para achar pronta entrega, oferta real ou marca específica.</span>
            )}
          </div>
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
                <p>Tente limpar filtros, mudar a marca ou ver as promoções disponíveis.</p>
                <div className="empty-actions">
                  <Link className="button secondary" href={clearHref}>
                    Limpar filtros
                  </Link>
                  <Link className="button primary" href="/promocoes">
                    Ver promoções
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </StoreShell>
  );
}
