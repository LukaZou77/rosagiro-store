import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminCatalogPrintButton } from "@/components/AdminCatalogPrintButton";
import { OptimizedProductImage } from "@/components/OptimizedProductImage";
import {
  catalogSkuRows,
  catalogStockLabel,
  catalogWholesaleLabel,
  customerCatalogDocumentTitle,
  hasCatalogWholesalePrice,
  normalizeCatalogPriceStatus,
  normalizeCatalogQuery,
  singleCatalogParam
} from "@/lib/admin-customer-catalog-core";
import { getCustomerCatalogPrintData } from "@/lib/admin-customer-catalog";
import { requireAdmin } from "@/lib/auth";
import { money } from "@/lib/money";
import { productQuantity } from "@/lib/product-conversion";
import { siteConfig } from "@/lib/site-config";
import { getStoreProfile } from "@/lib/store-profile";
import { buildWhatsAppBaseHref } from "@/lib/whatsapp";
import styles from "./print.module.css";

export const metadata: Metadata = {
  title: "Catálogo para clientes | RosaGiro Admin",
  robots: { index: false, follow: false, nocache: true }
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function countLabel(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export default async function AdminCustomerCatalogPrintPage({ searchParams }: PageProps) {
  const [admin, params, storeProfile] = await Promise.all([requireAdmin(), searchParams, getStoreProfile()]);
  const brandId = singleCatalogParam(params.brand);
  if (!brandId || brandId === "all") redirect("/admin/catalogo-clientes");

  const query = normalizeCatalogQuery(params.q);
  const categoryId = singleCatalogParam(params.category) || "all";
  const priceStatus = normalizeCatalogPriceStatus(params.price);
  const catalog = await getCustomerCatalogPrintData({ brandId, categoryId, query, priceStatus });
  if (!catalog) notFound();

  const documentTitle = customerCatalogDocumentTitle(catalog.brand.name);
  const whatsappHref = buildWhatsAppBaseHref(storeProfile.whatsapp);

  return (
    <main className={styles.shell}>
      <div className={styles.screenToolbar}>
        <Link href="/admin/catalogo-clientes">
          <ArrowLeft size={17} />
          Voltar ao gerador
        </Link>
        <div>
          <strong>{admin.name}</strong>
          <span>Revise a prévia e escolha “Salvar como PDF” na janela de impressão.</span>
        </div>
        <AdminCatalogPrintButton
          documentTitle={documentTitle}
          className={styles.printButton}
          statusClassName={styles.printStatus}
        />
      </div>

      <article className={styles.document}>
        <header className={styles.documentHeader}>
          <OptimizedProductImage
            src={siteConfig.brandAssets.headerImage}
            alt="RosaGiro - atacado de cosméticos em São Paulo"
            width={420}
            height={85}
            sizes="340px"
            priority
          />
          <div>
            <p>Catálogo de atacado</p>
            <h1>{catalog.brand.name}</h1>
            <span>
              {catalog.category?.label || "Todas as categorias"} · {countLabel(catalog.products.length, "produto", "produtos")} ·{" "}
              {countLabel(catalog.skuCount, "modelo", "modelos")}
            </span>
          </div>
        </header>

        <section className={styles.commercialStrip} aria-label="Condições comerciais">
          <div>
            <span>Pedido mínimo</span>
            <strong>{money(siteConfig.wholesale.minimumOrderCents)}</strong>
          </div>
          <div>
            <span>Atendimento</span>
            <strong>{storeProfile.whatsapp}</strong>
          </div>
          <div>
            <span>Entrega</span>
            <strong>Envio para todo o Brasil</strong>
          </div>
        </section>

        {catalog.groups.length > 1 ? (
          <nav className={styles.categoryIndex} aria-label="Índice de categorias">
            <strong>Encontre por categoria</strong>
            <div>
              {catalog.groups.map((group) => (
                <a href={`#categoria-${group.slug}`} key={group.id}>
                  {group.label} <span>{group.products.length}</span>
                </a>
              ))}
            </div>
          </nav>
        ) : null}

        {catalog.groups.map((group) => (
          <section className={styles.categorySection} id={`categoria-${group.slug}`} key={group.id}>
            <div className={styles.categoryHeading}>
              <div>
                <span>Categoria</span>
                <h2>{group.label}</h2>
              </div>
              <strong>{countLabel(group.products.length, "produto", "produtos")}</strong>
            </div>

            <table className={styles.catalogTable}>
              <colgroup>
                <col className={styles.productColumn} />
                <col className={styles.brandColumn} />
                <col className={styles.categoryColumn} />
                <col className={styles.modelColumn} />
                <col className={styles.unitColumn} />
                <col className={styles.wholesaleColumn} />
                <col className={styles.stockColumn} />
              </colgroup>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Marca</th>
                  <th>Categoria</th>
                  <th>Modelo</th>
                  <th>Unitário</th>
                  <th>Embalagem fechada</th>
                  <th>Estoque</th>
                </tr>
              </thead>
              {group.products.map((product) => {
                const skus = catalogSkuRows({
                  productImage: product.image,
                  productPriceCents: product.priceCents,
                  mpn: product.mpn,
                  skus: product.skus
                });
                const wholesalePriced = hasCatalogWholesalePrice(product.wholesalePackage);
                const inStock = productQuantity(product) > 0;

                return (
                  <tbody className={styles.productGroup} key={product.id}>
                    {skus.map((sku, index) => (
                      <tr key={sku.id}>
                        {index === 0 ? (
                          <td className={styles.productCell} rowSpan={skus.length}>
                            <OptimizedProductImage
                              src={product.image}
                              alt={product.name}
                              width={90}
                              height={90}
                              sizes="90px"
                              loading="eager"
                            />
                            <div>
                              <strong>{product.name}</strong>
                              <span>{product.subcategory}</span>
                              {skus.length > 1 ? <small>{skus.length} variações</small> : null}
                            </div>
                          </td>
                        ) : null}
                        {index === 0 ? <td rowSpan={skus.length}>{product.brand.name}</td> : null}
                        {index === 0 ? <td rowSpan={skus.length}>{product.category.label}</td> : null}
                        <td className={styles.modelCell}>
                          {skus.length > 1 ? (
                            <OptimizedProductImage
                              src={sku.image}
                              alt={`${product.name} ${sku.code}`}
                              width={38}
                              height={38}
                              sizes="38px"
                              loading="eager"
                            />
                          ) : null}
                          <div>
                            <strong>{sku.code}</strong>
                            {sku.name !== sku.code ? <span>{sku.name}</span> : null}
                          </div>
                        </td>
                        <td className={styles.unitPrice}>{money(sku.priceCents)}</td>
                        {index === 0 ? (
                          <td
                            className={wholesalePriced ? styles.wholesalePrice : styles.consultPrice}
                            rowSpan={skus.length}
                          >
                            {catalogWholesaleLabel(product.wholesalePackage)}
                          </td>
                        ) : null}
                        {index === 0 ? (
                          <td
                            className={`${styles.stockCell}${inStock ? "" : ` ${styles.stockCheck}`}`}
                            rowSpan={skus.length}
                          >
                            <span>{catalogStockLabel(inStock)}</span>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                );
              })}
            </table>
          </section>
        ))}

        {!catalog.products.length ? (
          <div className={styles.emptyDocument}>
            <strong>Nenhum produto encontrado para este filtro.</strong>
            <p>Volte ao gerador e amplie a marca, categoria ou condição de atacado.</p>
          </div>
        ) : null}

        <footer className={styles.documentFooter}>
          <div>
            <strong>RosaGiro · atacado de cosméticos</strong>
            <span>Estoque e preços sujeitos à confirmação antes do fechamento do pedido.</span>
          </div>
          <a href={whatsappHref}>WhatsApp {storeProfile.whatsapp}</a>
        </footer>
      </article>
    </main>
  );
}
