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
import { createAdminTranslator } from "@/lib/admin-i18n";
import { getAdminLocale } from "@/lib/admin-i18n-server";
import { prisma } from "@/lib/db";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminCategoriesPage({ searchParams }: PageProps) {
  const [admin, params, categories, locale] = await Promise.all([
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
    }),
    getAdminLocale()
  ]);
  const t = createAdminTranslator(locale);
  const error = single(params.error);
  const saved = single(params.saved);
  const deleted = single(params.deleted);
  const savedSubcategory = single(params.savedSubcategory);
  const deletedSubcategory = single(params.deletedSubcategory);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">{t("Categorias", "品类")}</p>
        <h1>{t("Categorias e prateleiras", "品类与货架结构")}</h1>
        <p>{t("Organize as entradas principais de navegação e filtros do catálogo.", "管理商品目录的主导航入口和筛选结构。")}</p>
      </div>

      {saved ? (
        <div className="admin-notice success" role="status">
          {t("Categoria salva com sucesso.", "品类保存成功。")}
        </div>
      ) : null}
      {deleted ? (
        <div className="admin-notice success" role="status">
          {t("Categoria excluída com sucesso.", "品类删除成功。")}
        </div>
      ) : null}
      {savedSubcategory ? (
        <div className="admin-notice success" role="status">
          {t("Subcategoria salva com sucesso.", "子品类保存成功。")}
        </div>
      ) : null}
      {deletedSubcategory ? (
        <div className="admin-notice success" role="status">
          {t("Subcategoria excluída com sucesso.", "子品类删除成功。")}
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="import-panel">
        <h2>{t("Nova categoria", "新建品类")}</h2>
        <form action={saveCategoryAction} className="admin-product-fields">
          <label>
            {t("Nome", "品类名称")}
            <input name="label" required />
          </label>
          <label>
            {t("Nota da categoria", "品类说明")}
            <textarea name="note" placeholder={t("Texto curto para cards e filtros.", "用于卡片和筛选的简短说明。") } />
          </label>
          <button className="button primary" type="submit">
            {t("Criar categoria", "创建品类")}
          </button>
        </form>
      </section>

      <section className="import-panel">
        <h2>{t("Nova subcategoria", "新建子品类")}</h2>
        <p className="table-note">
          {t("Use termos naturais do varejo brasileiro, como Base líquida, Batom líquido ou Máscara de cílios.", "前台葡语名称请使用巴西零售业自然用词，例如 Base líquida、Batom líquido 或 Máscara de cílios。")}
        </p>
        <form action={saveProductSubcategoryAction} className="admin-product-fields">
          <div className="form-grid">
            <label>
              {t("Categoria", "所属品类")}
              <select name="categoryId" required>
                {categories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Nome da subcategoria", "子品类名称")}
              <input name="label" placeholder="Ex: Batom líquido" required />
            </label>
            <label>
              {t("Ordem", "排序")}
              <input name="sortOrder" type="number" min="0" defaultValue="1000" />
            </label>
          </div>
          <button className="button primary" type="submit">
            {t("Criar subcategoria", "创建子品类")}
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
                  {t("Nome", "品类名称")}
                  <input name="label" defaultValue={category.label} required />
                </label>
                <label>
                  Slug
                  <input value={category.slug} readOnly />
                </label>
              </div>
              <label>
                {t("Nota da categoria", "品类说明")}
                <textarea name="note" defaultValue={category.note} />
              </label>
              <div className="admin-row-meta">
                <span>{category.slug}</span>
                <small>{category._count.products} {t("produtos", "个商品")}</small>
              </div>
              <div className="admin-actions">
                <button className="button secondary" type="submit">
                  {t("Salvar categoria", "保存品类")}
                </button>
                {category._count.products === 0 ? (
                  <AdminCategoryDeleteButton action={deleteCategoryAction} />
                ) : (
                  <button
                    className="button secondary"
                    type="button"
                    disabled
                    title={t("Mova ou remova os produtos antes de excluir.", "删除品类前请先移动或删除其商品。")}
                  >
                    {t("Categoria com produtos", "品类下有商品")}
                  </button>
                )}
              </div>
              {category._count.products > 0 ? (
                <p className="form-hint">{t("Esta categoria tem produtos. Mova ou remova os produtos antes de excluir.", "该品类下仍有商品，删除前请先移动或删除这些商品。")}</p>
              ) : null}
              </form>
              <div className="subcategory-admin-list">
                <strong>{t("Subcategorias", "子品类")}</strong>
                {category.subcategories.length ? (
                  category.subcategories.map((subcategory) => (
                    <form action={saveProductSubcategoryAction} className="subcategory-admin-row" key={subcategory.id}>
                      <input type="hidden" name="subcategoryId" value={subcategory.id} />
                      <input type="hidden" name="categoryId" value={category.id} />
                      <label>
                        {t("Nome", "名称")}
                        <input name="label" defaultValue={subcategory.label} required />
                      </label>
                      <label>
                        {t("Ordem", "排序")}
                        <input name="sortOrder" type="number" min="0" defaultValue={subcategory.sortOrder} />
                      </label>
                      <span>{subcategory._count.products} {t("produtos", "个商品")}</span>
                      <div className="admin-actions">
                        <button className="button secondary" type="submit">
                          {t("Salvar subcategoria", "保存子品类")}
                        </button>
                        {subcategory._count.products === 0 ? (
                          <AdminSubcategoryDeleteButton action={deleteProductSubcategoryAction} />
                        ) : (
                          <button
                            className="button secondary"
                            type="button"
                            disabled
                            title={t("Ajuste os produtos antes de excluir.", "删除前请先调整关联商品。")}
                          >
                            {t("Subcategoria com produtos", "子品类下有商品")}
                          </button>
                        )}
                      </div>
                    </form>
                  ))
                ) : (
                  <p className="form-hint">{t("Nenhuma subcategoria cadastrada para esta categoria.", "该品类尚未创建子品类。")}</p>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </AdminShell>
  );
}
