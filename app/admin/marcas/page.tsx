import { deleteBrandAction, saveBrandAction } from "@/app/admin/actions";
import { AdminBrandDeleteButton } from "@/components/AdminBrandDeleteButton";
import { AdminShell } from "@/components/AdminShell";
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

export default async function AdminBrandsPage({ searchParams }: PageProps) {
  const [admin, params, brands, locale] = await Promise.all([
    requireAdmin(),
    searchParams,
    prisma.brand.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" }
    }),
    getAdminLocale()
  ]);
  const t = createAdminTranslator(locale);
  const error = single(params.error);
  const saved = single(params.saved);
  const deleted = single(params.deleted);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">{t("Marcas", "品牌")}</p>
        <h1>{t("Marcas do catálogo", "商品品牌管理")}</h1>
        <p>{t("Organize as marcas multimarcas que aparecem nos produtos, filtros e vitrines.", "管理显示在商品、筛选和前台陈列中的品牌。")}</p>
      </div>

      {saved ? (
        <div className="admin-notice success" role="status">
          {t("Marca salva com sucesso.", "品牌保存成功。")}
        </div>
      ) : null}
      {deleted ? (
        <div className="admin-notice success" role="status">
          {t("Marca excluída com sucesso.", "品牌删除成功。")}
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="import-panel">
        <h2>{t("Nova marca", "新建品牌")}</h2>
        <form action={saveBrandAction} className="admin-product-fields">
          <div className="form-grid">
            <label>
              {t("Nome", "品牌名")}
              <input name="name" required />
            </label>
            <label>
              {t("Logo curto", "品牌缩写")}
              <input name="logo" placeholder="RG" maxLength={8} />
            </label>
            <label className="checkbox-label">
              <input name="featured" type="checkbox" />
              {t("Marca em destaque", "重点品牌")}
            </label>
          </div>
          <label>
            {t("Descrição", "品牌描述")}
            <textarea name="descriptionPt" placeholder={t("Descrição da marca para uso interno e vitrine.", "用于内部管理和前台展示的品牌描述。") } />
          </label>
          <button className="button primary" type="submit">
            {t("Criar marca", "创建品牌")}
          </button>
        </form>
      </section>

      <div className="admin-list">
        {brands.map((brand) => (
          <form action={saveBrandAction} className="admin-product-row catalog-row" key={brand.id}>
            <input type="hidden" name="brandId" value={brand.id} />
            <div className="brand-mark">{brand.logo}</div>
            <div className="admin-product-fields">
              <div className="form-grid">
                <label>
                  {t("Nome", "品牌名")}
                  <input name="name" defaultValue={brand.name} required />
                </label>
                <label>
                  {t("Logo curto", "品牌缩写")}
                  <input name="logo" defaultValue={brand.logo} maxLength={8} />
                </label>
                <label className="checkbox-label">
                  <input name="featured" type="checkbox" defaultChecked={brand.featured} />
                  {t("Marca em destaque", "重点品牌")}
                </label>
              </div>
              <label>
                {t("Descrição", "品牌描述")}
                <textarea name="descriptionPt" defaultValue={brand.descriptionPt} />
              </label>
              <div className="admin-row-meta">
                <span>{brand.slug}</span>
                <small>{brand._count.products} {t("produtos", "个商品")}</small>
              </div>
              <div className="admin-actions">
                <button className="button secondary" type="submit">
                  {t("Salvar marca", "保存品牌")}
                </button>
                {brand._count.products === 0 ? (
                  <AdminBrandDeleteButton action={deleteBrandAction} />
                ) : (
                  <button className="button secondary" type="button" disabled title={t("Mova ou remova os produtos antes de excluir.", "删除品牌前请先移动或删除其商品。") }>
                    {t("Marca com produtos", "品牌下有商品")}
                  </button>
                )}
              </div>
              {brand._count.products > 0 ? (
                <p className="form-hint">{t("Esta marca tem produtos. Mova ou remova os produtos antes de excluir.", "该品牌下仍有商品，删除品牌前请先移动或删除这些商品。")}</p>
              ) : null}
            </div>
          </form>
        ))}
      </div>
    </AdminShell>
  );
}
