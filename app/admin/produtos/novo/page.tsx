import Link from "next/link";
import { createProductAction } from "@/app/admin/actions";
import { AdminProductForm } from "@/components/AdminProductForm";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminNewProductPage({ searchParams }: PageProps) {
  const [admin, query, brands, categories] = await Promise.all([
    requireAdmin(),
    searchParams,
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({
      include: { subcategories: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } },
      orderBy: { label: "asc" }
    })
  ]);
  const error = single(query.error);
  const hasCatalogSetup = brands.length > 0 && categories.some((category) => category.subcategories.length > 0);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Novo produto</p>
        <h1>Cadastrar produto manualmente</h1>
        <p>Crie uma ficha completa para publicar um novo item sem importar CSV.</p>
        <div className="admin-actions">
          <Link className="button secondary" href="/admin/produtos">
            Voltar para produtos
          </Link>
          <Link className="button secondary" href="/admin/marcas">
            Marcas
          </Link>
          <Link className="button secondary" href="/admin/categorias">
            Categorias
          </Link>
        </div>
      </div>

      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}
      {!hasCatalogSetup ? (
        <div className="admin-notice warning" role="status">
          Cadastre pelo menos uma marca, uma categoria e uma subcategoria antes de criar produtos manuais.
        </div>
      ) : null}

      <section className="import-panel new-product-guidance">
        <div className="readiness-group-heading">
          <div>
            <span>Publicação</span>
            <h2>Salvar já sincroniza com a loja</h2>
          </div>
          <strong>1</strong>
        </div>
        <p className="table-note">
          Produto ativo aparece na vitrine depois de salvar. Para preparar sem publicar, desmarque Produto ativo e revise
          na central de qualidade antes de liberar.
        </p>
      </section>

      <AdminProductForm action={createProductAction} brands={brands} categories={categories} mode="create" />
    </AdminShell>
  );
}
