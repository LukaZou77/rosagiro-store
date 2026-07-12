import type { Prisma } from "@/src/generated/prisma/client";
import Link from "next/link";
import { moveProductsToTrashAction, saveProductPriceAdjustmentAction } from "@/app/admin/actions";
import { AdminPriceAdjustmentJobProgress } from "@/components/AdminPriceAdjustmentJobProgress";
import { AdminPriceAdjustmentResultDialog } from "@/components/AdminPriceAdjustmentResultDialog";
import { AdminPriceAdjustmentSubmitButton } from "@/components/AdminPriceAdjustmentSubmitButton";
import { AdminProductBulkList, type AdminProductListRow } from "@/components/AdminProductBulkList";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { createAdminTranslator } from "@/lib/admin-i18n";
import { getAdminLocale } from "@/lib/admin-i18n-server";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { formatPlainBrl, parsePriceAdjustmentInput, priceAdjustmentLabel } from "@/lib/product-price-adjustment";
import { configFromStoreProfile, previewPriceAdjustment } from "@/lib/product-price-adjustment-server";
import { evaluateProductQuality } from "@/lib/product-quality";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const pageSize = 50;

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function numberParam(value: string | string[] | undefined) {
  const parsed = Number(single(value) || "0");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function productPageHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/admin/produtos?${next.toString()}`;
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const [admin, params, locale] = await Promise.all([requireAdmin(), searchParams, getAdminLocale()]);
  const t = createAdminTranslator(locale);
  const [brands, categories, priceProfile] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { label: "asc" } }),
    prisma.storeProfile.findUnique({
      where: { id: "main" },
      select: {
        priceAdjustmentDirection: true,
        priceAdjustmentType: true,
        priceAdjustmentValue: true
      }
    })
  ]);
  const q = single(params.q)?.trim() || "";
  const brand = single(params.brand) || "all";
  const category = single(params.category) || "all";
  const status = single(params.status) || "all";
  const stock = single(params.stock) || "all";
  const requestedPage = Math.max(1, numberParam(params.page) || 1);
  const trashed = single(params.trashed);
  const error = single(params.error);
  const priceAdjusted = single(params.priceAdjusted);
  const priceAdjustedSkus = single(params.priceAdjustedSkus);
  const priceAdjustmentJob = single(params.priceAdjustmentJob);
  const priceSkippedProducts = single(params.priceSkippedProducts);
  const priceSkippedSkus = single(params.priceSkippedSkus);
  const legacyPriceSkipped = single(params.priceSkipped);
  const priceWarnings = single(params.priceWarnings);
  const priceResult = priceAdjusted
    ? {
        productCount: numberParam(priceAdjusted),
        skuCount: numberParam(priceAdjustedSkus),
        skippedProductCount: priceSkippedProducts ? numberParam(priceSkippedProducts) : numberParam(legacyPriceSkipped),
        skippedSkuCount: numberParam(priceSkippedSkus),
        descriptionWarningCount: numberParam(priceWarnings)
      }
    : null;
  const pricePreviewRequested = single(params.pricePreview) === "1";
  const savedPriceAdjustment = configFromStoreProfile(priceProfile);
  const savedPriceAdjustmentLabel = locale === "zh-CN"
    ? savedPriceAdjustment.direction === "none"
      ? "未设置"
      : `${savedPriceAdjustment.direction === "increase" ? "涨价" : "降价"} ${savedPriceAdjustment.type === "fixed" ? `R$ ${formatPlainBrl(savedPriceAdjustment.value)}` : `${savedPriceAdjustment.value / 100}%`}`
    : priceAdjustmentLabel(savedPriceAdjustment);
  const savedPriceAdjustmentInput =
    savedPriceAdjustment.direction === "none"
      ? ""
      : savedPriceAdjustment.type === "fixed"
        ? formatPlainBrl(savedPriceAdjustment.value)
        : String(savedPriceAdjustment.value / 100).replace(".", ",");
  const draftPriceDirection = single(params.priceAdjustmentDirection);
  const draftPriceType = single(params.priceAdjustmentType);
  const draftPriceValue = single(params.priceAdjustmentValue);
  const savedPriceDirection = savedPriceAdjustment.direction === "none" ? "increase" : savedPriceAdjustment.direction;
  const priceDirection = pricePreviewRequested ? draftPriceDirection || savedPriceDirection : savedPriceDirection;
  const priceType = pricePreviewRequested ? draftPriceType || savedPriceAdjustment.type : savedPriceAdjustment.type;
  const priceValue = pricePreviewRequested ? draftPriceValue ?? savedPriceAdjustmentInput : savedPriceAdjustmentInput;
  const requestedPriceAdjustment = parsePriceAdjustmentInput({
    direction: priceDirection,
    type: priceType,
    value: priceValue
  });
  const pricePreview =
    pricePreviewRequested && requestedPriceAdjustment.direction !== "none"
      ? await previewPriceAdjustment(requestedPriceAdjustment)
      : null;

  const where: Prisma.ProductWhereInput = {
    AND: [
      { deletedAt: null },
      brand !== "all" ? { brandId: brand } : {},
      category !== "all" ? { categoryId: category } : {},
      status === "active" ? { active: true } : status === "inactive" ? { active: false } : {},
      stock === "in"
        ? { inventory: { quantity: { gt: 0 } } }
        : stock === "out"
          ? { OR: [{ inventory: null }, { inventory: { quantity: 0 } }] }
          : {},
      q
        ? {
            OR: [
              { slug: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { subcategory: { contains: q, mode: "insensitive" } },
              { brand: { name: { contains: q, mode: "insensitive" } } },
              { category: { label: { contains: q, mode: "insensitive" } } },
              { mpn: { contains: q, mode: "insensitive" } },
              { gtin: { contains: q, mode: "insensitive" } },
              { skus: { some: { code: { contains: q, mode: "insensitive" } } } }
            ]
          }
        : {}
    ]
  };

  const totalProducts = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const [activeCount, inStockCount, outOfStockCount, products] = await Promise.all([
    prisma.product.count({ where: { AND: [where, { active: true }] } }),
    prisma.product.count({ where: { AND: [where, { inventory: { quantity: { gt: 0 } } }] } }),
    prisma.product.count({ where: { AND: [where, { OR: [{ inventory: null }, { inventory: { quantity: 0 } }] }] } }),
    prisma.product.findMany({
      where,
      include: { brand: true, category: true, inventory: true },
      orderBy: [{ featuredRank: "asc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  const qualityItems = products.map(evaluateProductQuality);
  const qualityActionCount = qualityItems.filter((item) => item.status === "ACTION_REQUIRED").length;
  const qualityBySlug = new Map(qualityItems.map((item) => [item.slug, item]));
  const productRows: AdminProductListRow[] = products.map((product) => {
    const quantity = product.inventory?.quantity || 0;
    const quality = qualityBySlug.get(product.slug);
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      image: product.image,
      active: product.active,
      inStock: quantity > 0,
      brandName: product.brand.name,
      categoryLabel: product.category.label,
      subcategory: product.subcategory,
      price: money(product.priceCents),
      featuredRank: product.featuredRank,
      weightGrams: product.weightGrams,
      qualityStatusLabel: quality?.statusLabel || null,
      qualityStatusClass: quality ? `quality-${quality.status.toLowerCase().replace("_", "-")}` : null
    };
  });
  const preserved = new URLSearchParams();
  if (q) preserved.set("q", q);
  if (brand !== "all") preserved.set("brand", brand);
  if (category !== "all") preserved.set("category", category);
  if (status !== "all") preserved.set("status", status);
  if (stock !== "all") preserved.set("stock", stock);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">{t("Produtos", "商品")}</p>
        <h1>{t("Central de produtos", "商品管理")}</h1>
        <p>{t("Filtre, revise e abra cada item para editar a ficha completa do catálogo.", "筛选和检查商品，打开单个商品即可编辑完整资料。")}</p>
        <div className="admin-actions">
          <Link className="button primary" href="/admin/produtos/novo" prefetch={false}>
            {t("Novo produto", "新建商品")}
          </Link>
        </div>
      </div>

      {trashed ? (
        <div className="admin-notice success" role="status">
          {trashed} {t("produto(s) movido(s) para a lixeira.", "个商品已移入回收站。")}
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}
      {priceAdjusted ? (
        <div className="admin-notice success" role="status">
          {t("Ajuste aplicado em", "已调整")} {priceResult?.productCount || 0} {t("produto(s) e", "个商品及")} {priceResult?.skuCount || 0} {t("SKU.", "个 SKU。")}
          {priceResult && priceResult.skippedProductCount + priceResult.skippedSkuCount > 0
            ? `${priceResult.skippedProductCount + priceResult.skippedSkuCount} ${t("item(ns) foram ignorados por preço mínimo.", "项因最低价格限制被跳过。")}`
            : ""}
          {priceResult && priceResult.descriptionWarningCount > 0
            ? ` ${priceResult.descriptionWarningCount} ${t("descrição(ões) personalizada(s) não foram alteradas.", "条自定义描述未被修改。")}`
            : ""}
        </div>
      ) : null}
      {priceResult ? <AdminPriceAdjustmentResultDialog {...priceResult} /> : null}
      {priceAdjustmentJob ? <AdminPriceAdjustmentJobProgress jobId={priceAdjustmentJob} /> : null}

      <section className="import-panel">
        <div className="product-gallery-heading">
          <div>
            <strong>{t("Ajuste global de preços", "全局价格调整")}</strong>
            <small>
              {t("Regra atual: ", "当前规则：")}{savedPriceAdjustmentLabel}{t(". Aplica em todos os produtos fora da lixeira, incluindo itens ativos e inativos.", "。适用于回收站以外的全部商品，包括启用和停用商品。")}
            </small>
          </div>
        </div>
        <form className="filters admin-filters" action="/admin/produtos">
          <input name="pricePreview" type="hidden" value="1" />
          <label>
            {t("Operação", "操作")}
            <select name="priceAdjustmentDirection" defaultValue={priceDirection === "none" ? "increase" : priceDirection}>
              <option value="increase">{t("Aumentar", "涨价")}</option>
              <option value="decrease">{t("Reduzir", "降价")}</option>
            </select>
          </label>
          <label>
            {t("Tipo", "方式")}
            <select name="priceAdjustmentType" defaultValue={priceType}>
              <option value="percent">{t("Percentual %", "百分比 %")}</option>
              <option value="fixed">{t("Valor fixo R$", "固定金额 R$")}</option>
            </select>
          </label>
          <label>
            {t("Valor", "调整值")}
            <input name="priceAdjustmentValue" defaultValue={priceValue} inputMode="decimal" placeholder="Ex: 20 ou 1,00" />
          </label>
          <button className="button secondary" type="submit">
            {t("Pré-visualizar impacto", "预览影响")}
          </button>
        </form>

        {pricePreview ? (
          <div className="admin-form-block">
            <div className="metric-grid compact">
              <div>
                <span>{t("Produtos alteráveis", "可调整商品")}</span>
                <strong>{pricePreview.productCount}</strong>
              </div>
              <div>
                <span>{t("SKU alteráveis", "可调整 SKU")}</span>
                <strong>{pricePreview.skuCount}</strong>
              </div>
              <div>
                <span>{t("Ignorados", "已跳过")}</span>
                <strong>{pricePreview.skippedProductCount + pricePreview.skippedSkuCount}</strong>
              </div>
              <div>
                <span>{t("Descrições personalizadas", "自定义描述")}</span>
                <strong>{pricePreview.descriptionWarningCount}</strong>
              </div>
            </div>
            {pricePreview.examples.length ? (
              <div className="admin-list compact">
                {pricePreview.examples.map((example) => (
                  <div className="admin-list-row" key={example.slug}>
                    <div>
                      <strong>{example.name}</strong>
                      <p>
                        {money(example.oldPriceCents)} → {money(example.newPriceCents)} · {example.note}
                      </p>
                    </div>
                    <Link className="button secondary" href={`/admin/produtos/${example.slug}`} prefetch={false}>
                      {t("Ver ficha", "查看资料")}
                    </Link>
                  </div>
                ))}
              </div>
            ) : null}
            <form action={saveProductPriceAdjustmentAction} className="filters admin-filters">
              <input name="priceAdjustmentDirection" type="hidden" value={requestedPriceAdjustment.direction} />
              <input name="priceAdjustmentType" type="hidden" value={requestedPriceAdjustment.type} />
              <input name="priceAdjustmentValue" type="hidden" value={priceValue} />
              <label>
                {t("Confirmação", "确认")}
                <input name="confirmPriceAdjustment" placeholder={t("Digite rosagiro", "输入 rosagiro")} />
              </label>
              <AdminPriceAdjustmentSubmitButton />
            </form>
          </div>
        ) : (
          <p className="table-note">
            {t("Primeiro pré-visualize. Ajustes fixos são por unidade; a embalagem de atacado muda pelo número de peças.", "请先预览。固定金额按单件计算；整件批发价会根据件数同步变化。")}
          </p>
        )}
      </section>

      <div className="metric-grid compact">
        <div>
          <span>{t("Resultado", "筛选结果")}</span>
          <strong>{totalProducts}</strong>
          <small>{t("Página", "第")} {page} {t("de", "页，共")} {totalPages} {locale === "zh-CN" ? "页" : ""}</small>
        </div>
        <div>
          <span>{t("Ativos", "启用")}</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>{t("Em estoque", "有货")}</span>
          <strong>{inStockCount}</strong>
        </div>
        <div>
          <span>{t("Sem estoque", "缺货")}</span>
          <strong>{outOfStockCount}</strong>
        </div>
        <Link href="/admin/produtos/qualidade" prefetch={false}>
          <span>{t("Críticos nesta página", "本页严重问题")}</span>
          <strong>{qualityActionCount}</strong>
        </Link>
      </div>

      <form className="filters admin-filters" action="/admin/produtos">
        <label>
          {t("Buscar", "搜索")}
          <input name="q" defaultValue={q} placeholder={t("Nome, slug, marca...", "商品名、slug、品牌……")} />
        </label>
        <label>
          {t("Marca", "品牌")}
          <select name="brand" defaultValue={brand}>
            <option value="all">{t("Todas", "全部")}</option>
            {brands.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Categoria", "品类")}
          <select name="category" defaultValue={category}>
            <option value="all">{t("Todas", "全部")}</option>
            {categories.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Status", "状态")}
          <select name="status" defaultValue={status}>
            <option value="all">{t("Todos", "全部")}</option>
            <option value="active">{t("Ativos", "启用")}</option>
            <option value="inactive">{t("Inativos", "停用")}</option>
          </select>
        </label>
        <label>
          {t("Disponibilidade", "库存状态")}
          <select name="stock" defaultValue={stock}>
            <option value="all">{t("Todos", "全部")}</option>
            <option value="in">{t("Em estoque", "有货")}</option>
            <option value="out">{t("Sem estoque", "缺货")}</option>
          </select>
        </label>
        <button className="button primary" type="submit">
          {t("Aplicar", "应用")}
        </button>
        <Link className="button secondary" href="/admin/produtos" prefetch={false}>
          {t("Limpar", "清除")}
        </Link>
      </form>

      {productRows.length ? <AdminProductBulkList products={productRows} action={moveProductsToTrashAction} /> : null}
      <div className="admin-list">
        {!products.length ? (
          <div className="empty-state">
            <strong>{t("Nenhum produto encontrado", "未找到商品")}</strong>
            <p>{t("Limpe os filtros, importe uma planilha ou cadastre um produto manualmente.", "请清除筛选条件、导入表格或手动新建商品。")}</p>
            <div className="admin-actions">
              <Link className="button primary" href="/admin/produtos/novo" prefetch={false}>
                {t("Novo produto", "新建商品")}
              </Link>
              <Link className="button secondary" href="/admin/importar-produtos" prefetch={false}>
                {t("Importar CSV", "导入 CSV")}
              </Link>
            </div>
          </div>
        ) : null}
      </div>
      {totalPages > 1 ? (
        <nav className="admin-pagination" aria-label={t("Paginação de produtos", "商品分页")}>
          <Link className={page <= 1 ? "is-disabled" : ""} href={productPageHref(preserved, Math.max(1, page - 1))} prefetch={false} aria-disabled={page <= 1}>
            {t("Anterior", "上一页")}
          </Link>
          <span>{t("Página", "第")} {page} {t("de", "页，共")} {totalPages} {locale === "zh-CN" ? `页 · ${totalProducts} 个商品` : `· ${totalProducts} produtos`}</span>
          <Link className={page >= totalPages ? "is-disabled" : ""} href={productPageHref(preserved, Math.min(totalPages, page + 1))} prefetch={false} aria-disabled={page >= totalPages}>
            {t("Próxima", "下一页")}
          </Link>
        </nav>
      ) : null}
    </AdminShell>
  );
}
