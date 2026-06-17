import {
  deleteCategoryAction,
  deleteProductSubcategoryAction,
  saveCategoryAction,
  saveProductSubcategoryAction
} from "@/app/admin/actions";
import { AdminCategoryDeleteButton } from "@/components/AdminCategoryDeleteButton";
import { AdminShell } from "@/components/AdminShell";
import { AdminSubcategoryDeleteButton } from "@/components/AdminSubcategoryDeleteButton";
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
      include: {
        _count: { select: { products: true } },
        subcategories: {
          include: { _count: { select: { products: true } } },
          orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
        }
      },
      orderBy: { label: "asc" }
    })
  ]);
  const error = single(params.error);
  const saved = single(params.saved);
  const deleted = single(params.deleted);
  const savedSubcategory = single(params.savedSubcategory);
  const deletedSubcategory = single(params.deletedSubcategory);

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
      {deleted ? (
        <div className="admin-notice success" role="status">
          Categoria excluída com sucesso.
        </div>
      ) : null}
      {savedSubcategory ? (
        <div className="admin-notice success" role="status">
          Subcategoria salva com sucesso.
        </div>
      ) : null}
      {deletedSubcategory ? (
        <div className="admin-notice success" role="status">
          Subcategoria excluída com sucesso.
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

      <section className="import-panel">
        <h2>Nova subcategoria</h2>
        <p className="table-note">
          Use termos naturais do varejo brasileiro, como Base líquida, Batom líquido ou Máscara de cílios.
        </p>
        <form action={saveProductSubcategoryAction} className="admin-product-fields">
          <div className="form-grid">
            <label>
              Categoria
              <select name="categoryId" required>
                {categories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nome da subcategoria
              <input name="label" placeholder="Ex: Batom líquido" required />
            </label>
            <label>
              Ordem
              <input name="sortOrder" type="number" min="0" defaultValue="1000" />
            </label>
          </div>
          <button className="button primary" type="submit">
            Criar subcategoria
          </button>
        </form>
      </section>

      <div className="admin-list">
        {categories.map((category) => (
          <article className="admin-product-row catalog-row" key={category.id}>
            <div className="admin-product-fields full-width">
              <form action={saveCategoryAction} className="admin-product-fields">
                <input type="hidden" name="categoryId" value={category.id} />
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
              <div className="admin-actions">
                <button className="button secondary" type="submit">
                  Salvar categoria
                </button>
                {category._count.products === 0 ? (
                  <AdminCategoryDeleteButton action={deleteCategoryAction} />
                ) : (
                  <button
                    className="button secondary"
                    type="button"
                    disabled
                    title="Mova ou remova os produtos antes de excluir."
                  >
                    Categoria com produtos
                  </button>
                )}
              </div>
              {category._count.products > 0 ? (
                <p className="form-hint">Esta categoria tem produtos. Mova ou remova os produtos antes de excluir.</p>
              ) : null}
              </form>
              <div className="subcategory-admin-list">
                <strong>Subcategorias</strong>
                {category.subcategories.length ? (
                  category.subcategories.map((subcategory) => (
                    <form action={saveProductSubcategoryAction} className="subcategory-admin-row" key={subcategory.id}>
                      <input type="hidden" name="subcategoryId" value={subcategory.id} />
                      <input type="hidden" name="categoryId" value={category.id} />
                      <label>
                        Nome
                        <input name="label" defaultValue={subcategory.label} required />
                      </label>
                      <label>
                        Ordem
                        <input name="sortOrder" type="number" min="0" defaultValue={subcategory.sortOrder} />
                      </label>
                      <span>{subcategory._count.products} produtos</span>
                      <div className="admin-actions">
                        <button className="button secondary" type="submit">
                          Salvar subcategoria
                        </button>
                        {subcategory._count.products === 0 ? (
                          <AdminSubcategoryDeleteButton action={deleteProductSubcategoryAction} />
                        ) : (
                          <button
                            className="button secondary"
                            type="button"
                            disabled
                            title="Ajuste os produtos antes de excluir."
                          >
                            Subcategoria com produtos
                          </button>
                        )}
                      </div>
                    </form>
                  ))
                ) : (
                  <p className="form-hint">Nenhuma subcategoria cadastrada para esta categoria.</p>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </AdminShell>
  );
}
