import type { Metadata } from "next";
import Link from "next/link";
import { FileDown, PackageSearch } from "lucide-react";
import { AdminCatalogBulkDownload } from "@/components/AdminCatalogBulkDownload";
import { AdminShell } from "@/components/AdminShell";
import { OptimizedProductImage } from "@/components/OptimizedProductImage";
import {
  catalogSkuRows,
  catalogUnitPriceLabel,
  catalogWholesaleLabel,
  hasCatalogWholesalePrice,
  normalizeCatalogPage,
  normalizeCatalogPriceStatus,
  normalizeCatalogQuery,
  singleCatalogParam
} from "@/lib/admin-customer-catalog-core";
import { getCustomerCatalogOptions, getCustomerCatalogPreview } from "@/lib/admin-customer-catalog";
import { requireAdmin } from "@/lib/auth";
import { siteConfig } from "@/lib/site-config";
import { getStoreProfile } from "@/lib/store-profile";
import styles from "./catalog.module.css";

export const metadata: Metadata = {
  title: "Catálogo para clientes | RosaGiro Admin",
  robots: { index: false, follow: false, nocache: true }
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function catalogPageHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/admin/catalogo-clientes?${next.toString()}`;
}

export default async function AdminCustomerCatalogPage({ searchParams }: PageProps) {
  const [admin, params] = await Promise.all([requireAdmin(), searchParams]);
  const query = normalizeCatalogQuery(params.q);
  const brandId = singleCatalogParam(params.brand) || "all";
  const categoryId = singleCatalogParam(params.category) || "all";
  const priceStatus = normalizeCatalogPriceStatus(params.price);
  const requestedPage = normalizeCatalogPage(params.page);
  const [options, preview, storeProfile] = await Promise.all([
    getCustomerCatalogOptions(),
    getCustomerCatalogPreview({ query, brandId, categoryId, priceStatus, page: requestedPage }),
    getStoreProfile()
  ]);

  const selectedBrand = options.brands.find((brand) => brand.id === brandId) || null;
  const selectedCategory = options.categories.find((category) => category.id === categoryId) || null;
  const preserved = new URLSearchParams();
  if (query) preserved.set("q", query);
  if (brandId !== "all") preserved.set("brand", brandId);
  if (categoryId !== "all") preserved.set("category", categoryId);
  if (priceStatus !== "all") preserved.set("price", priceStatus);

  const printParams = new URLSearchParams(preserved);
  printParams.delete("page");
  const printHref = selectedBrand ? `/admin/catalogo-clientes/imprimir?${printParams.toString()}` : null;

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Ferramenta interna</p>
        <h1>Catálogo para clientes</h1>
        <p>Filtre o catálogo ativo, revise modelos e gere um PDF por marca para enviar diretamente aos clientes.</p>
        <div className="admin-actions">
          <AdminCatalogBulkDownload
            brands={options.brands.map((brand) => ({ id: brand.id, name: brand.name }))}
            headerImage={siteConfig.brandAssets.headerImage}
            minimumOrderCents={siteConfig.wholesale.minimumOrderCents}
            whatsapp={storeProfile.whatsapp}
          />
          {printHref ? (
            <Link className="button primary" href={printHref} prefetch={false} target="_blank" rel="noreferrer">
              <FileDown size={17} />
              Gerar PDF da marca
            </Link>
          ) : (
            <span className="button secondary" aria-disabled="true" title="Selecione uma marca para gerar o PDF">
              <FileDown size={17} />
              Selecione uma marca
            </span>
          )}
        </div>
      </div>

      <section className={styles.filterPanel} aria-label="Filtros do catálogo para clientes">
        <div className={styles.filterIntro}>
          <PackageSearch size={20} />
          <div>
            <strong>Monte o arquivo antes de enviar</strong>
            <span>O PDF sempre usa uma única marca; a categoria e a busca são opcionais.</span>
          </div>
        </div>
        <form className="filters admin-filters" action="/admin/catalogo-clientes">
          <label>
            Buscar produto ou modelo
            <input name="q" defaultValue={query} placeholder="Nome, código ou SKU" />
          </label>
          <label>
            Marca
            <select name="brand" defaultValue={brandId}>
              <option value="all">Todas as marcas</option>
              {options.brands.map((brand) => (
                <option value={brand.id} key={brand.id}>
                  {brand.name} ({brand._count.products})
                </option>
              ))}
            </select>
          </label>
          <label>
            Categoria
            <select name="category" defaultValue={categoryId}>
              <option value="all">Todas as categorias</option>
              {options.categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.label} ({category._count.products})
                </option>
              ))}
            </select>
          </label>
          <label>
            Condição de atacado
            <select name="price" defaultValue={priceStatus}>
              <option value="all">Todos</option>
              <option value="priced">Com preço da embalagem fechada</option>
              <option value="consult">Consultar no WhatsApp</option>
            </select>
          </label>
          <button className="button primary" type="submit">
            Aplicar filtros
          </button>
          <Link className="button secondary" href="/admin/catalogo-clientes" prefetch={false}>
            Limpar
          </Link>
        </form>
      </section>

      <div className={styles.metrics} aria-label="Resumo dos resultados">
        <div>
          <span>Produtos encontrados</span>
          <strong>{preview.total}</strong>
          <small>Página {preview.page} de {preview.totalPages}</small>
        </div>
        <div>
          <span>Modelos / SKU</span>
          <strong>{preview.skuCount}</strong>
          <small>Todos os modelos ativos</small>
        </div>
        <div>
          <span>Embalagem fechada</span>
          <strong>{preview.pricedCount}</strong>
          <small>Condição pronta para o PDF</small>
        </div>
        <div>
          <span>Sob consulta</span>
          <strong>{preview.consultCount}</strong>
          <small>Sem preço inventado</small>
        </div>
      </div>

      <section className={styles.previewPanel}>
        <div className={styles.previewHeading}>
          <div>
            <span>Pré-visualização</span>
            <strong>
              {selectedBrand?.name || "Todas as marcas"}
              {selectedCategory ? ` · ${selectedCategory.label}` : ""}
            </strong>
          </div>
          <small>50 produtos por página</small>
        </div>

        <div className={styles.columnHeader} aria-hidden="true">
          <span>Produto</span>
          <span>Marca / categoria</span>
          <span>Modelo</span>
          <span>Unitário</span>
          <span>Embalagem fechada</span>
        </div>

        <div className={styles.productList}>
          {preview.products.map((product) => {
            const skus = catalogSkuRows({
              productImage: product.image,
              productPriceCents: product.priceCents,
              mpn: product.mpn,
              skus: product.skus
            });
            const visibleCodes = skus.slice(0, 4);
            const wholesalePriced = hasCatalogWholesalePrice(product.wholesalePackage);

            return (
              <article className={styles.productRow} key={product.id}>
                <div className={styles.productIdentity}>
                  <OptimizedProductImage
                    src={product.image}
                    alt={product.name}
                    width={88}
                    height={88}
                    sizes="88px"
                  />
                  <div>
                    <strong>{product.name}</strong>
                    <span>{product.subcategory}</span>
                  </div>
                </div>
                <div className={styles.productMeta} data-label="Marca / categoria">
                  <strong>{product.brand.name}</strong>
                  <span>{product.category.label}</span>
                </div>
                <div className={styles.modelList} data-label="Modelo">
                  {visibleCodes.map((sku) => (
                    <code key={sku.id}>{sku.code}</code>
                  ))}
                  {skus.length > visibleCodes.length ? <small>+{skus.length - visibleCodes.length} variações</small> : null}
                </div>
                <strong className={styles.unitPrice} data-label="Unitário">
                  {catalogUnitPriceLabel(product.priceCents, product.skus)}
                </strong>
                <div
                  className={`${styles.wholesalePrice}${wholesalePriced ? "" : ` ${styles.consultPrice}`}`}
                  data-label="Embalagem fechada"
                >
                  {catalogWholesaleLabel(product.wholesalePackage)}
                </div>
              </article>
            );
          })}

          {!preview.products.length ? (
            <div className={styles.emptyState}>
              <strong>Nenhum produto encontrado</strong>
              <p>Limpe a busca ou altere marca, categoria e condição de atacado.</p>
            </div>
          ) : null}
        </div>
      </section>

      {preview.totalPages > 1 ? (
        <nav className="admin-pagination" aria-label="Paginação do catálogo para clientes">
          <Link
            className={preview.page <= 1 ? "is-disabled" : ""}
            href={catalogPageHref(preserved, Math.max(1, preview.page - 1))}
            prefetch={false}
            aria-disabled={preview.page <= 1}
          >
            Anterior
          </Link>
          <span>Página {preview.page} de {preview.totalPages} · {preview.total} produtos</span>
          <Link
            className={preview.page >= preview.totalPages ? "is-disabled" : ""}
            href={catalogPageHref(preserved, Math.min(preview.totalPages, preview.page + 1))}
            prefetch={false}
            aria-disabled={preview.page >= preview.totalPages}
          >
            Próxima
          </Link>
        </nav>
      ) : null}
    </AdminShell>
  );
}
