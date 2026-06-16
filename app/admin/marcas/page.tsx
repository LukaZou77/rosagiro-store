import { deleteBrandAction, saveBrandAction } from "@/app/admin/actions";
import { AdminBrandDeleteButton } from "@/components/AdminBrandDeleteButton";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminBrandsPage({ searchParams }: PageProps) {
  const [admin, params, brands] = await Promise.all([
    requireAdmin(),
    searchParams,
    prisma.brand.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" }
    })
  ]);
  const error = single(params.error);
  const saved = single(params.saved);
  const deleted = single(params.deleted);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Marcas</p>
        <h1>Marcas do catálogo</h1>
        <p>Organize as marcas multimarcas que aparecem nos produtos, filtros e vitrines.</p>
      </div>

      {saved ? (
        <div className="admin-notice success" role="status">
          Marca salva com sucesso.
        </div>
      ) : null}
      {deleted ? (
        <div className="admin-notice success" role="status">
          Marca excluída com sucesso.
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="import-panel">
        <h2>Nova marca</h2>
        <form action={saveBrandAction} className="admin-product-fields">
          <div className="form-grid">
            <label>
              Nome
              <input name="name" required />
            </label>
            <label>
              Logo curto
              <input name="logo" placeholder="RG" maxLength={8} />
            </label>
            <label className="checkbox-label">
              <input name="featured" type="checkbox" />
              Marca em destaque
            </label>
          </div>
          <label>
            Descrição
            <textarea name="descriptionPt" placeholder="Descrição da marca para uso interno e vitrine." />
          </label>
          <button className="button primary" type="submit">
            Criar marca
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
                  Nome
                  <input name="name" defaultValue={brand.name} required />
                </label>
                <label>
                  Logo curto
                  <input name="logo" defaultValue={brand.logo} maxLength={8} />
                </label>
                <label className="checkbox-label">
                  <input name="featured" type="checkbox" defaultChecked={brand.featured} />
                  Marca em destaque
                </label>
              </div>
              <label>
                Descrição
                <textarea name="descriptionPt" defaultValue={brand.descriptionPt} />
              </label>
              <div className="admin-row-meta">
                <span>{brand.slug}</span>
                <small>{brand._count.products} produtos</small>
              </div>
              <div className="admin-actions">
                <button className="button secondary" type="submit">
                  Salvar marca
                </button>
                {brand._count.products === 0 ? (
                  <AdminBrandDeleteButton action={deleteBrandAction} />
                ) : (
                  <button className="button secondary" type="button" disabled title="Mova ou remova os produtos antes de excluir.">
                    Marca com produtos
                  </button>
                )}
              </div>
              {brand._count.products > 0 ? (
                <p className="form-hint">Esta marca tem produtos. Mova ou remova os produtos antes de excluir.</p>
              ) : null}
            </div>
          </form>
        ))}
      </div>
    </AdminShell>
  );
}
