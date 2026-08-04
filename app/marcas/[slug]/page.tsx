import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { StoreShell } from "@/components/StoreShell";
import { StructuredData } from "@/components/StructuredData";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { CATALOG_PAGE_SIZE, getActiveBrandSummary, getCategories, getProductPage } from "@/lib/catalog";
import {
  MIN_INDEXABLE_BRAND_PRODUCTS,
  brandIntroText,
  brandMetaDescription,
  brandMetadataTitle,
  breadcrumbJsonLd,
  catalogIndexing,
  itemListJsonLd,
  noIndexMetadata,
  storefrontMetadata
} from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";
import { getStoreProfile } from "@/lib/store-profile";
import { buildGeneralWhatsAppHref } from "@/lib/whatsapp";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] || "" : input || "";
}

function safePage(input: string) {
  const parsed = Number.parseInt(input || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function brandPageHref(slug: string, page: number) {
  return page > 1 ? `/marcas/${slug}?page=${page}` : `/marcas/${slug}`;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ slug }, queryParams] = await Promise.all([params, searchParams]);
  const brand = await getActiveBrandSummary(slug);
  if (!brand) return noIndexMetadata("Marca", "Marca não encontrada no catálogo RosaGiro.");

  const page = safePage(value(queryParams.page));
  const path = `/marcas/${brand.slug}`;
  const indexing = catalogIndexing({
    path,
    page,
    query: "",
    brand: "all",
    stockFilter: "all",
    sort: "featured",
    totalPages: Math.ceil(brand.productCount / CATALOG_PAGE_SIZE)
  });
  const metadata = storefrontMetadata({
    title: brandMetadataTitle(brand.name, page),
    description: brandMetaDescription(brand.name, brand.productCount, page),
    path: indexing.canonicalPath
  });

  if (!indexing.shouldNoIndex && brand.productCount >= MIN_INDEXABLE_BRAND_PRODUCTS) return metadata;
  return {
    ...metadata,
    robots: {
      index: false,
      follow: true
    }
  };
}

function BrandPagination({ slug, page, totalPages }: { slug: string; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;

  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, page + 2);
  const pages = Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);

  return (
    <nav className="catalog-pagination" aria-label="Paginação dos produtos da marca">
      {page === 1 ? (
        <span className="disabled">Anterior</span>
      ) : (
        <Link href={brandPageHref(slug, page - 1)}>Anterior</Link>
      )}
      <div>
        {startPage > 1 ? <span>...</span> : null}
        {pages.map((item) => (
          <Link
            className={item === page ? "active" : ""}
            href={brandPageHref(slug, item)}
            key={item}
            aria-current={item === page ? "page" : undefined}
          >
            {item}
          </Link>
        ))}
        {endPage < totalPages ? <span>...</span> : null}
      </div>
      {page === totalPages ? (
        <span className="disabled">Próxima</span>
      ) : (
        <Link href={brandPageHref(slug, page + 1)}>Próxima</Link>
      )}
    </nav>
  );
}

export default async function BrandPage({ params, searchParams }: PageProps) {
  const [{ slug }, queryParams] = await Promise.all([params, searchParams]);
  const requestedPage = safePage(value(queryParams.page));
  const brand = await getActiveBrandSummary(slug);
  if (!brand) notFound();

  const [categories, productPage, storeProfile] = await Promise.all([
    getCategories(),
    getProductPage({ brandName: brand.name, page: requestedPage, pageSize: CATALOG_PAGE_SIZE }),
    getStoreProfile()
  ]);
  if (requestedPage > Math.max(1, productPage.totalPages)) notFound();

  const intro = brandIntroText(brand.name, productPage.total);
  const whatsappHref = buildGeneralWhatsAppHref(storeProfile.whatsapp);

  return (
    <StoreShell categories={categories}>
      <StructuredData
        data={[
          breadcrumbJsonLd([
            { name: "Início", path: "/" },
            { name: "Marcas", path: "/marcas" },
            { name: brand.name, path: `/marcas/${brand.slug}` }
          ]),
          itemListJsonLd(productPage.products.map((product) => ({ name: product.name, path: `/produto/${product.slug}` })))
        ]}
      />

      <section className="catalog-header brand-catalog-header">
        <Link className="back-link" href="/marcas">
          Ver todas as marcas
        </Link>
        <p className="eyebrow">Marca no atacado</p>
        <h1>{brand.name} no atacado para revenda</h1>
        <p>{intro}</p>
        <div className="catalog-service-bar">
          <span>{siteConfig.wholesale.minimumOrderText}</span>
          <span>{siteConfig.wholesale.nationalDeliveryLabel}</span>
          <WhatsAppLink href={whatsappHref} className="service-whatsapp">
            {siteConfig.whatsapp.serviceLabel}
          </WhatsAppLink>
        </div>
        <div className="catalog-summary-strip" aria-label={`Resumo da marca ${brand.name}`}>
          <span>
            <strong>{productPage.total}</strong>
            Produtos
          </span>
          <span>
            <strong>R$ 500</strong>
            Pedido mínimo
          </span>
          <span>
            <strong>Brasil</strong>
            Entrega por CEP
          </span>
          <span>
            <strong>Pix</strong>
            Pagamento
          </span>
        </div>
      </section>

      <section className="section brand-directory-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Produtos da marca</p>
            <h2>
              Produtos {brand.name}
              {productPage.page > 1 ? ` - página ${productPage.page}` : ""}
            </h2>
          </div>
          <p>
            {productPage.total} {productPage.total === 1 ? "produto disponível" : "produtos disponíveis"} no catálogo para combinar com outras marcas no mesmo pedido.
          </p>
        </div>

        <div className="product-grid">
          {productPage.products.map((product) => (
            <ProductCard product={product} whatsappPhone={storeProfile.whatsapp} key={product.slug} />
          ))}
        </div>
        <BrandPagination slug={brand.slug} page={productPage.page} totalPages={productPage.totalPages} />
      </section>
    </StoreShell>
  );
}
