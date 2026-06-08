import type { Prisma } from "@/src/generated/prisma/client";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { evaluateProductQuality } from "@/lib/product-quality";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const [admin, params, brands, categories] = await Promise.all([
    requireAdmin(),
    searchParams,
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { label: "asc" } })
  ]);
  const q = single(params.q)?.trim() || "";
  const brand = single(params.brand) || "all";
  const category = single(params.category) || "all";
  const status = single(params.status) || "all";
  const stock = single(params.stock) || "all";

  const where: Prisma.ProductWhereInput = {
    brandId: brand !== "all" ? brand : undefined,
    categoryId: category !== "all" ? category : undefined,
    active: status === "active" ? true : status === "inactive" ? false : undefined,
    inventory:
      stock === "in"
        ? { quantity: { gt: 0 } }
        : stock === "low"
          ? { quantity: { gt: 0, lte: 5 } }
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

  const products = await prisma.product.findMany({
    where,
    include: { brand: true, category: true, inventory: true },
    orderBy: [{ featuredRank: "asc" }, { updatedAt: "desc" }]
  });

  const activeCount = products.filter((product) => product.active).length;
  const lowStockCount = products.filter((product) => {
    const quantity = product.inventory?.quantity || 0;
    return quantity > 0 && quantity <= 5;
  }).length;
  const outOfStockCount = products.filter((product) => (product.inventory?.quantity || 0) === 0).length;
  const qualityItems = products.map(evaluateProductQuality);
  const qualityActionCount = qualityItems.filter((item) => item.status === "ACTION_REQUIRED").length;
  const qualityBySlug = new Map(qualityItems.map((item) => [item.slug, item]));

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
          <Link className="button secondary" href="/admin/importar-produtos">
            Importar / modelos
          </Link>
          <Link className="button secondary" href="/admin/produtos/exportar" prefetch={false}>
            Exportar CSV
          </Link>
        </div>
      </div>

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
          <span>Estoque baixo</span>
          <strong>{lowStockCount}</strong>
        </div>
        <div>
          <span>Esgotados</span>
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
          Estoque
          <select name="stock" defaultValue={stock}>
            <option value="all">Todos</option>
            <option value="in">Em estoque</option>
            <option value="low">Baixo</option>
            <option value="out">Esgotado</option>
          </select>
        </label>
        <button className="button primary" type="submit">
          Aplicar
        </button>
        <Link className="button secondary" href="/admin/produtos">
          Limpar
        </Link>
      </form>

      <div className="admin-list">
        {products.map((product) => {
          const quantity = product.inventory?.quantity || 0;
          const quality = qualityBySlug.get(product.slug);
          return (
            <article className="admin-product-row catalog-row" key={product.id}>
              <img src={product.image} alt={product.name} />
              <div className="admin-product-summary">
                <div>
                  <span className="status-chip">{product.slug}</span>
                  <span className={product.active ? "status-chip success" : "status-chip warning"}>
                    {product.active ? "Ativo" : "Inativo"}
                  </span>
                  <span className={quantity > 0 ? "status-chip success" : "status-chip warning"}>
                    {quantity > 0 ? "Em estoque" : "Esgotado"}
                  </span>
                  {quality ? (
                    <span className={`status-chip quality-${quality.status.toLowerCase().replace("_", "-")}`}>
                      {quality.statusLabel}
                    </span>
                  ) : null}
                </div>
                <h2>{product.name}</h2>
                <p>
                  {product.brand.name} / {product.category.label} / {product.subcategory}
                </p>
                <div className="admin-row-meta">
                  <strong>{money(product.priceCents)}</strong>
                  {product.compareAtPriceCents ? <span>{money(product.compareAtPriceCents)}</span> : null}
                  <small>Rank {product.featuredRank}</small>
                  <small>{product.weightGrams} g</small>
                </div>
              </div>
              <div className="admin-row-actions">
                <Link className="button secondary" href={`/produto/${product.slug}`}>
                  Ver loja
                </Link>
                <Link className="button primary" href={`/admin/produtos/${product.slug}`}>
                  Editar ficha
                </Link>
              </div>
            </article>
          );
        })}
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
