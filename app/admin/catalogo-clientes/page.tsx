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
import { createAdminTranslator } from "@/lib/admin-i18n";
import { getAdminLocale } from "@/lib/admin-i18n-server";
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
  const [admin, params, locale] = await Promise.all([requireAdmin(), searchParams, getAdminLocale()]);
  const t = createAdminTranslator(locale);
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
        <p className="eyebrow">{t("Ferramenta interna", "内部工具")}</p>
        <h1>{t("Catálogo para clientes", "客户货盘目录")}</h1>
        <p>{t("Baixe um único PDF com todas as marcas ou filtre o catálogo para gerar um arquivo específico.", "可下载包含全部品牌的一份总目录，也可筛选后生成指定品牌的 PDF。")}</p>
        <div className="admin-actions">
          <AdminCatalogBulkDownload
            brandCount={options.brands.length}
            headerImage={siteConfig.brandAssets.headerImage}
            minimumOrderCents={siteConfig.wholesale.minimumOrderCents}
            whatsapp={storeProfile.whatsapp}
          />
          {printHref ? (
            <Link className="button primary" href={printHref} prefetch={false} target="_blank" rel="noreferrer">
              <FileDown size={17} />
              {t("Gerar PDF da marca", "生成该品牌 PDF")}
            </Link>
          ) : (
            <span className="button secondary" aria-disabled="true" title={t("Selecione uma marca para gerar o PDF", "请选择一个品牌后生成 PDF")}>
              <FileDown size={17} />
              {t("Selecione uma marca", "请选择品牌")}
            </span>
          )}
        </div>
      </div>

      <section className={styles.filterPanel} aria-label={t("Filtros do catálogo para clientes", "客户目录筛选")}>
        <div className={styles.filterIntro}>
          <PackageSearch size={20} />
          <div>
            <strong>{t("Monte o arquivo antes de enviar", "发送前先生成目录")}</strong>
            <span>{t("O catálogo completo reúne todas as marcas; para um arquivo menor, selecione uma marca abaixo.", "完整总目录包含全部品牌；如需更小文件，可在下方选择单个品牌。")}</span>
          </div>
        </div>
        <form className="filters admin-filters" action="/admin/catalogo-clientes">
          <label>
            {t("Buscar produto ou modelo", "搜索商品或型号")}
            <input name="q" defaultValue={query} placeholder={t("Nome, código ou SKU", "商品名、编码或 SKU")} />
          </label>
          <label>
            {t("Marca", "品牌")}
            <select name="brand" defaultValue={brandId}>
              <option value="all">{t("Todas as marcas", "全部品牌")}</option>
              {options.brands.map((brand) => (
                <option value={brand.id} key={brand.id}>
                  {brand.name} ({brand._count.products})
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Categoria", "品类")}
            <select name="category" defaultValue={categoryId}>
              <option value="all">{t("Todas as categorias", "全部品类")}</option>
              {options.categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.label} ({category._count.products})
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Condição de atacado", "批发条件")}
            <select name="price" defaultValue={priceStatus}>
              <option value="all">{t("Todos", "全部")}</option>
              <option value="priced">{t("Com preço da embalagem fechada", "已有整件价格")}</option>
              <option value="consult">{t("Consultar no WhatsApp", "需通过 WhatsApp 咨询")}</option>
            </select>
          </label>
          <button className="button primary" type="submit">
            {t("Aplicar filtros", "应用筛选")}
          </button>
          <Link className="button secondary" href="/admin/catalogo-clientes" prefetch={false}>
            {t("Limpar", "清除")}
          </Link>
        </form>
      </section>

      <div className={styles.metrics} aria-label={t("Resumo dos resultados", "结果摘要")}>
        <div>
          <span>{t("Produtos encontrados", "找到的商品")}</span>
          <strong>{preview.total}</strong>
          <small>{t("Página", "第")} {preview.page} {t("de", "页，共")} {preview.totalPages} {locale === "zh-CN" ? "页" : ""}</small>
        </div>
        <div>
          <span>{t("Modelos / SKU", "型号 / SKU")}</span>
          <strong>{preview.skuCount}</strong>
          <small>{t("Todos os modelos ativos", "全部启用型号")}</small>
        </div>
        <div>
          <span>{t("Embalagem fechada", "整件包装")}</span>
          <strong>{preview.pricedCount}</strong>
          <small>{t("Condição pronta para o PDF", "批发条件可直接生成 PDF")}</small>
        </div>
        <div>
          <span>{t("Sob consulta", "需要咨询")}</span>
          <strong>{preview.consultCount}</strong>
          <small>{t("Sem preço inventado", "不会虚构价格")}</small>
        </div>
      </div>

      <section className={styles.previewPanel}>
        <div className={styles.previewHeading}>
          <div>
            <span>{t("Pré-visualização", "预览")}</span>
            <strong>
              {selectedBrand?.name || t("Todas as marcas", "全部品牌")}
              {selectedCategory ? ` · ${selectedCategory.label}` : ""}
            </strong>
          </div>
          <small>{t("50 produtos por página", "每页 50 个商品")}</small>
        </div>

        <div className={styles.columnHeader} aria-hidden="true">
          <span>{t("Produto", "商品")}</span>
          <span>{t("Marca / categoria", "品牌 / 品类")}</span>
          <span>{t("Modelo", "型号")}</span>
          <span>{t("Unitário", "单价")}</span>
          <span>{t("Embalagem fechada", "整件包装")}</span>
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
                  {skus.length > visibleCodes.length ? <small>+{skus.length - visibleCodes.length} {t("variações", "个规格")}</small> : null}
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
              <strong>{t("Nenhum produto encontrado", "未找到商品")}</strong>
              <p>{t("Limpe a busca ou altere marca, categoria e condição de atacado.", "请清除搜索或调整品牌、品类和批发条件。")}</p>
            </div>
          ) : null}
        </div>
      </section>

      {preview.totalPages > 1 ? (
        <nav className="admin-pagination" aria-label={t("Paginação do catálogo para clientes", "客户目录分页")}>
          <Link
            className={preview.page <= 1 ? "is-disabled" : ""}
            href={catalogPageHref(preserved, Math.max(1, preview.page - 1))}
            prefetch={false}
            aria-disabled={preview.page <= 1}
          >
            {t("Anterior", "上一页")}
          </Link>
          <span>{t("Página", "第")} {preview.page} {t("de", "页，共")} {preview.totalPages} {locale === "zh-CN" ? `页 · ${preview.total} 个商品` : `· ${preview.total} produtos`}</span>
          <Link
            className={preview.page >= preview.totalPages ? "is-disabled" : ""}
            href={catalogPageHref(preserved, Math.min(preview.totalPages, preview.page + 1))}
            prefetch={false}
            aria-disabled={preview.page >= preview.totalPages}
          >
            {t("Próxima", "下一页")}
          </Link>
        </nav>
      ) : null}
    </AdminShell>
  );
}
