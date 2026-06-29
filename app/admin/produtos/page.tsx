import type { Prisma } from "@/src/generated/prisma/client";
import Link from "next/link";
import { moveProductsToTrashAction, saveProductPriceAdjustmentAction } from "@/app/admin/actions";
import { AdminPriceAdjustmentResultDialog } from "@/components/AdminPriceAdjustmentResultDialog";
import { AdminProductBulkList, type AdminProductListRow } from "@/components/AdminProductBulkList";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { formatPlainBrl, parsePriceAdjustmentInput, priceAdjustmentLabel } from "@/lib/product-price-adjustment";
import { configFromStoreProfile, previewPriceAdjustment } from "@/lib/product-price-adjustment-server";
import { evaluateProductQuality } from "@/lib/product-quality";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function numberParam(value: string | string[] | undefined) {
  const parsed = Number(single(value) || "0");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const [admin, params, brands, categories, priceProfile] = await Promise.all([
    requireAdmin(),
    searchParams,
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
  const trashed = single(params.trashed);
  const error = single(params.error);
  const priceAdjusted = single(params.priceAdjusted);
  const priceAdjustedSkus = single(params.priceAdjustedSkus);
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
    deletedAt: null,
    brandId: brand !== "all" ? brand : undefined,
    categoryId: category !== "all" ? category : undefined,
    active: status === "active" ? true : status === "inactive" ? false : undefined,
    inventory:
      stock === "in"
        ? { quantity: { gt: 0 } }
        : stock === "out"
          ? { quantity: 0 }
          : undefined,
    OR: q
      ? [
          { slug: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { subcategory: { contains: q, mode: "insensitive" } },
          { brand: { name: { contains: q, mode: "insensitive" } } },
          { category: { label: { contains: q, mode: "insensitive" } } }
        ]
      : undefined
  };

  const [products, trashCount] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { brand: true, category: true, inventory: true },
      orderBy: [{ featuredRank: "asc" }, { updatedAt: "desc" }]
    }),
    prisma.product.count({ where: { deletedAt: { not: null } } })
  ]);

  const activeCount = products.filter((product) => product.active).length;
  const inStockCount = products.filter((product) => (product.inventory?.quantity || 0) > 0).length;
  const outOfStockCount = products.filter((product) => (product.inventory?.quantity || 0) === 0).length;
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

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Produtos</p>
        <h1>Central de produtos</h1>
        <p>Filtre, revise e abra cada item para editar a ficha completa do catálogo.</p>
        <div className="admin-actions">
          <Link className="button primary" href="/admin/produtos/novo">
            Novo produto
          </Link>
          <Link className="button secondary" href="/admin/produtos/qualidade">
            Ver qualidade
          </Link>
          <Link className="button secondary" href="/admin/produtos/lixeira">
            Lixeira {trashCount ? `(${trashCount})` : ""}
          </Link>
          <Link className="button secondary" href="/admin/importar-produtos">
            Importar / modelos
          </Link>
          <Link className="button secondary" href="/admin/produtos/exportar" prefetch={false}>
            Exportar CSV
          </Link>
        </div>
      </div>

      {trashed ? (
        <div className="admin-notice success" role="status">
          {trashed} produto(s) movido(s) para a lixeira.
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}
      {priceAdjusted ? (
        <div className="admin-notice success" role="status">
          Ajuste aplicado em {priceResult?.productCount || 0} produto(s) e {priceResult?.skuCount || 0} SKU(s).{" "}
          {priceResult && priceResult.skippedProductCount + priceResult.skippedSkuCount > 0
            ? `${priceResult.skippedProductCount + priceResult.skippedSkuCount} item(ns) foram ignorados por preço mínimo.`
            : ""}
          {priceResult && priceResult.descriptionWarningCount > 0
            ? ` ${priceResult.descriptionWarningCount} descrição(ões) personalizada(s) não foram alteradas.`
            : ""}
        </div>
      ) : null}
      {priceResult ? <AdminPriceAdjustmentResultDialog {...priceResult} /> : null}

      <section className="import-panel">
        <div className="product-gallery-heading">
          <div>
            <strong>Ajuste global de preços</strong>
            <small>
              Regra atual: {priceAdjustmentLabel(savedPriceAdjustment)}. Aplica em todos os produtos fora da lixeira,
              incluindo itens ativos e inativos.
            </small>
          </div>
        </div>
        <form className="filters admin-filters" action="/admin/produtos">
          <input name="pricePreview" type="hidden" value="1" />
          <label>
            Operação
            <select name="priceAdjustmentDirection" defaultValue={priceDirection === "none" ? "increase" : priceDirection}>
              <option value="increase">Aumentar</option>
              <option value="decrease">Reduzir</option>
            </select>
          </label>
          <label>
            Tipo
            <select name="priceAdjustmentType" defaultValue={priceType}>
              <option value="percent">Percentual %</option>
              <option value="fixed">Valor fixo R$</option>
            </select>
          </label>
          <label>
            Valor
            <input name="priceAdjustmentValue" defaultValue={priceValue} inputMode="decimal" placeholder="Ex: 20 ou 1,00" />
          </label>
          <button className="button secondary" type="submit">
            Pré-visualizar impacto
          </button>
        </form>

        {pricePreview ? (
          <div className="admin-form-block">
            <div className="metric-grid compact">
              <div>
                <span>Produtos alteráveis</span>
                <strong>{pricePreview.productCount}</strong>
              </div>
              <div>
                <span>SKU alteráveis</span>
                <strong>{pricePreview.skuCount}</strong>
              </div>
              <div>
                <span>Ignorados</span>
                <strong>{pricePreview.skippedProductCount + pricePreview.skippedSkuCount}</strong>
              </div>
              <div>
                <span>Descrições personalizadas</span>
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
                    <Link className="button secondary" href={`/admin/produtos/${example.slug}`}>
                      Ver ficha
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
                Confirmação
                <input name="confirmPriceAdjustment" placeholder="Digite rosagiro" />
              </label>
              <button className="button primary" type="submit">
                Salvar regra e aplicar em todos
              </button>
            </form>
          </div>
        ) : (
          <p className="table-note">
            Primeiro pré-visualize. Ajustes fixos são por unidade; a embalagem de atacado muda pelo número de peças.
          </p>
        )}
      </section>

      <div className="metric-grid compact">
        <div>
          <span>Resultado</span>
          <strong>{products.length}</strong>
        </div>
        <div>
          <span>Ativos</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>Em estoque</span>
          <strong>{inStockCount}</strong>
        </div>
        <div>
          <span>Sem estoque</span>
          <strong>{outOfStockCount}</strong>
        </div>
        <Link href="/admin/produtos/qualidade">
          <span>Qualidade crítica</span>
          <strong>{qualityActionCount}</strong>
        </Link>
      </div>

      <form className="filters admin-filters" action="/admin/produtos">
        <label>
          Buscar
          <input name="q" defaultValue={q} placeholder="Nome, slug, marca..." />
        </label>
        <label>
          Marca
          <select name="brand" defaultValue={brand}>
            <option value="all">Todas</option>
            {brands.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Categoria
          <select name="category" defaultValue={category}>
            <option value="all">Todas</option>
            {categories.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={status}>
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </label>
        <label>
          Disponibilidade
          <select name="stock" defaultValue={stock}>
            <option value="all">Todos</option>
            <option value="in">Em estoque</option>
            <option value="out">Sem estoque</option>
          </select>
        </label>
        <button className="button primary" type="submit">
          Aplicar
        </button>
        <Link className="button secondary" href="/admin/produtos">
          Limpar
        </Link>
      </form>

      {productRows.length ? <AdminProductBulkList products={productRows} action={moveProductsToTrashAction} /> : null}
      <div className="admin-list">
        {!products.length ? (
          <div className="empty-state">
            <strong>Nenhum produto encontrado</strong>
            <p>Limpe os filtros, importe uma planilha ou cadastre um produto manualmente.</p>
            <div className="admin-actions">
              <Link className="button primary" href="/admin/produtos/novo">
                Novo produto
              </Link>
              <Link className="button secondary" href="/admin/importar-produtos">
                Importar CSV
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
