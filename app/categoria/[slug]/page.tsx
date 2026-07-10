import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { StoreShell } from "@/components/StoreShell";
import { StructuredData } from "@/components/StructuredData";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import {
  CATALOG_PAGE_SIZE,
  getBrandOptionsForCategory,
  getCategories,
  getProductAvailabilityCounts,
  getProductCount,
  getProductPage
} from "@/lib/catalog";
import {
  breadcrumbJsonLd,
  catalogIndexing,
  categoryIntroText,
  categoryMetaDescription,
  categoryMetadataTitle,
  itemListJsonLd,
  noIndexMetadata,
  storefrontMetadata
} from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";
import { getStoreProfile } from "@/lib/store-profile";
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
  ready: "Em estoque",
  out: "Sem estoque"
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

function safePage(value: string | undefined) {
  const page = Number(value || "1");
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

function catalogHref(categorySlug: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, item]) => {
    if (!item || item === "all" || (key === "sort" && item === "featured") || (key === "page" && item === "1")) return;
    search.set(key, item);
  });
  const query = search.toString();
  return `/categoria/${categorySlug}${query ? `?${query}` : ""}`;
}

async function categorySeoContext(slug: string) {
  const [categories, productCount] = await Promise.all([getCategories(), getProductCount({ categorySlug: slug })]);
  const currentCategory = categories.find((category) => category.slug === slug);
  const label = slug === "all" ? "Todas as categorias" : currentCategory?.label || "Categoria";
  return { categories, productCount, currentCategory, label };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ slug }, queryParams] = await Promise.all([params, searchParams]);
  const categorySlug = slug || "all";
  const { currentCategory, label, productCount } = await categorySeoContext(categorySlug);
  if (categorySlug !== "all" && !currentCategory) {
    return noIndexMetadata("Categoria", "Categoria RosaGiro indisponível.");
  }
  const path = `/categoria/${categorySlug}`;
  const isAllCategory = categorySlug === "all";
  const page = safePage(value(queryParams.page));
  const indexing = catalogIndexing({
    path,
    page,
    query: value(queryParams.q) || "",
    brand: value(queryParams.brand) || "all",
    stockFilter: safeStock(value(queryParams.stock) || "all"),
    sort: safeSort(value(queryParams.sort) || "featured"),
    totalPages: Math.ceil(productCount / CATALOG_PAGE_SIZE)
  });
  const metadata = storefrontMetadata({
    title: categoryMetadataTitle(label, isAllCategory, page),
    description: categoryMetaDescription(label, productCount, isAllCategory, page),
    path: indexing.canonicalPath
  });

  if (!indexing.shouldNoIndex) return metadata;
  return {
    ...metadata,
    robots: {
      index: false,
      follow: true
    }
  };
}

function FilterFields({
  brand,
  brandOptions,
  query,
  sort,
  stockFilter
}: {
  brand: string;
  brandOptions: string[];
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
        Disponibilidade
        <select name="stock" defaultValue={stockFilter}>
          <option value="all">Todos</option>
          <option value="ready">Em estoque</option>
          <option value="out">Sem estoque</option>
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

function CatalogPagination({
  categorySlug,
  page,
  totalPages,
  query,
  brand,
  stockFilter,
  sort
}: {
  categorySlug: string;
  page: number;
  totalPages: number;
  query: string;
  brand: string;
  stockFilter: string;
  sort: string;
}) {
  if (totalPages <= 1) return null;

  const previousPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);
  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, page + 2);
  const pages = Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
  const hrefForPage = (targetPage: number) =>
    catalogHref(categorySlug, {
      q: query,
      brand,
      stock: stockFilter,
      sort,
      page: String(targetPage)
    });

  return (
    <nav className="catalog-pagination" aria-label="Paginação do catálogo">
      <Link className={page === 1 ? "disabled" : ""} href={hrefForPage(previousPage)} aria-disabled={page === 1}>
        Anterior
      </Link>
      <div>
        {startPage > 1 ? <span>...</span> : null}
        {pages.map((item) => (
          <Link
            className={item === page ? "active" : ""}
            href={hrefForPage(item)}
            key={item}
            aria-current={item === page ? "page" : undefined}
            aria-label={`Ir para a página ${item}`}
          >
            {item}
          </Link>
        ))}
        {endPage < totalPages ? <span>...</span> : null}
      </div>
      <Link className={page === totalPages ? "disabled" : ""} href={hrefForPage(nextPage)} aria-disabled={page === totalPages}>
        Próxima
      </Link>
    </nav>
  );
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const [{ slug }, queryParams] = await Promise.all([params, searchParams]);
  const categorySlug = slug || "all";
  const brand = value(queryParams.brand) || "all";
  const query = value(queryParams.q) || "";
  const sort = safeSort(value(queryParams.sort) || "featured");
  const stockFilter = safeStock(value(queryParams.stock) || "all");
  const page = safePage(value(queryParams.page));
  const [categories, brandOptions, productPage, availabilityCounts, storeProfile] = await Promise.all([
    getCategories(),
    getBrandOptionsForCategory(categorySlug),
    getProductPage({ categorySlug, brandName: brand, query, sort, stockFilter, page, pageSize: CATALOG_PAGE_SIZE }),
    getProductAvailabilityCounts({ categorySlug, brandName: brand, query }),
    getStoreProfile()
  ]);
  const { products, total, totalPages } = productPage;
  if (page > Math.max(1, totalPages)) notFound();
  const currentCategory = categories.find((category) => category.slug === categorySlug);
  const categoryLabel = categorySlug === "all" ? "Todas as categorias" : currentCategory?.label || "Categoria";
  const isAllCategory = categorySlug === "all";
  const categoryTitle = categoryMetadataTitle(categoryLabel, isAllCategory);
  const categoryIntro = categoryIntroText(categoryLabel, total, isAllCategory);
  const whatsappHref = buildCatalogWhatsAppHref(categoryLabel, total, storeProfile.whatsapp);
  const sortLabel = sortLabels[sort] || sortLabels.featured;
  const clearHref = catalogHref(categorySlug, {});
  const filterCount = [query ? "q" : "", brand !== "all" ? "brand" : "", stockFilter !== "all" ? "stock" : ""].filter(Boolean).length;
  const activeFilters = [
    query ? { key: "q", label: `Busca: ${query}`, href: catalogHref(categorySlug, { brand, stock: stockFilter, sort }) } : null,
    brand !== "all" ? { key: "brand", label: `Marca: ${brand}`, href: catalogHref(categorySlug, { q: query, stock: stockFilter, sort }) } : null,
    stockFilter !== "all" ? { key: "stock", label: stockLabels[stockFilter], href: catalogHref(categorySlug, { q: query, brand, sort }) } : null
  ].filter((item): item is { key: string; label: string; href: string } => Boolean(item));
  const readyCount = availabilityCounts.ready;
  const outOfStockCount = availabilityCounts.out;

  return (
    <StoreShell categories={categories}>
      <StructuredData
        data={[
          breadcrumbJsonLd([
            { name: "Início", path: "/" },
            { name: "Catálogo", path: "/categoria/all" },
            { name: categoryLabel, path: `/categoria/${categorySlug}` }
          ]),
          itemListJsonLd(products.map((product) => ({ name: product.name, path: `/produto/${product.slug}` })))
        ]}
      />
      <section className="catalog-header">
        <p className="eyebrow">Catálogo</p>
        <h1>{categoryTitle}</h1>
        <p>{categoryIntro}</p>
        <form className="catalog-quick-search" action={`/categoria/${categorySlug}`}>
          <input
            name="q"
            defaultValue={query}
            placeholder="Buscar produto, marca ou código"
            aria-label="Buscar produto, marca ou código"
          />
          <input type="hidden" name="brand" value={brand} />
          <input type="hidden" name="stock" value={stockFilter} />
          <input type="hidden" name="sort" value={sort} />
          <button className="button primary" type="submit">
            Buscar
          </button>
        </form>
        <div className="catalog-service-bar">
          <span>{siteConfig.wholesale.minimumOrderText}</span>
          <span>{siteConfig.wholesale.nationalDeliveryLabel}</span>
          <WhatsAppLink href={whatsappHref} className="service-whatsapp">
            {siteConfig.whatsapp.serviceLabel}
          </WhatsAppLink>
        </div>
        <div className="catalog-summary-strip" aria-label="Resumo de compra da categoria">
          <span>
            <strong>{readyCount}</strong>
            Em estoque
          </span>
          <span>
            <strong>{brandOptions.length}</strong>
            Marcas
          </span>
          <span>
            <strong>{outOfStockCount}</strong>
            Sem estoque
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
                <small>{total} produtos</small>
              </div>
              <p>{siteConfig.mobilePurchase.filterHint}</p>
              <form className="filters" action={`/categoria/${categorySlug}`}>
                <FilterFields brand={brand} brandOptions={brandOptions} query={query} sort={sort} stockFilter={stockFilter} />
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
          <FilterFields brand={brand} brandOptions={brandOptions} query={query} sort={sort} stockFilter={stockFilter} />
          <Link className="button secondary wide" href={clearHref}>
            Limpar filtros
          </Link>
        </form>
        <div>
          <h2 className="catalog-results-title">
            {isAllCategory
              ? "Produtos disponíveis no catálogo"
              : `Produtos disponíveis na categoria ${categoryLabel}`}
          </h2>
          <div className="catalog-results-bar">
            <div>
              <strong>{total} produtos encontrados</strong>
              <span>
                Página {productPage.page} de {totalPages} / Ordenado por {sortLabel}
              </span>
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
              <span className="catalog-result-hint">Use filtros para achar produtos em estoque, marca específica ou menor preço.</span>
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
              products.map((product) => <ProductCard product={product} whatsappPhone={storeProfile.whatsapp} key={product.slug} />)
            ) : (
              <div className="empty-state">
                <strong>Nenhum produto encontrado</strong>
                <p>Tente limpar filtros, mudar a marca ou ver os destaques disponíveis.</p>
                <div className="empty-actions">
                  <Link className="button secondary" href={clearHref}>
                    Limpar filtros
                  </Link>
                  <Link className="button primary" href="/promocoes">
                    Ver destaques
                  </Link>
                </div>
              </div>
            )}
          </div>
          <CatalogPagination
            brand={brand}
            categorySlug={categorySlug}
            page={productPage.page}
            query={query}
            sort={sort}
            stockFilter={stockFilter}
            totalPages={totalPages}
          />
        </div>
      </section>
    </StoreShell>
  );
}
