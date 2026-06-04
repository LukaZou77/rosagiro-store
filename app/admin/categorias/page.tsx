import { saveCategoryAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminCategoriesPage({ searchParams }: PageProps) {
  const [admin, params, categories] = await Promise.all([
    requireAdmin(),
    searchParams,
    prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { label: "asc" }
    })
  ]);
  const error = single(params.error);
  const saved = single(params.saved);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Categorias</p>
        <h1>Categorias e prateleiras</h1>
        <p>Organize as entradas principais de navegação e filtros do catálogo.</p>
      </div>

      {saved ? (
        <div className="admin-notice success" role="status">
          Categoria salva com sucesso.
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="import-panel">
        <h2>Nova categoria</h2>
        <form action={saveCategoryAction} className="admin-product-fields">
          <label>
            Nome
            <input name="label" required />
          </label>
          <label>
            Nota da categoria
            <textarea name="note" placeholder="Texto curto para cards e filtros." />
          </label>
          <button className="button primary" type="submit">
            Criar categoria
          </button>
        </form>
      </section>

      <div className="admin-list">
        {categories.map((category) => (
          <form action={saveCategoryAction} className="admin-product-row catalog-row" key={category.id}>
            <input type="hidden" name="categoryId" value={category.id} />
            <div className="admin-product-fields">
              <div className="form-grid">
                <label>
                  Nome
                  <input name="label" defaultValue={category.label} required />
                </label>
                <label>
                  Slug
                  <input value={category.slug} readOnly />
                </label>
              </div>
              <label>
                Nota da categoria
                <textarea name="note" defaultValue={category.note} />
              </label>
              <div className="admin-row-meta">
                <span>{category.slug}</span>
                <small>{category._count.products} produtos</small>
              </div>
              <button className="button secondary" type="submit">
                Salvar categoria
              </button>
            </div>
          </form>
        ))}
      </div>
    </AdminShell>
  );
}
