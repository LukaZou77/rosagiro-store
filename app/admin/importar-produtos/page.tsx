import { importProductsAction } from "@/app/admin/actions";
import { AdminProductImportClient } from "@/components/AdminProductImportClient";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminProductImportPage({ searchParams }: PageProps) {
  const [admin, params] = await Promise.all([requireAdmin(), searchParams]);
  const error = single(params.error);
  const created = single(params.created);
  const updated = single(params.updated);
  const stock = single(params.stock);
  const hasResult = created || updated || stock;

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Importacao</p>
        <h1>Importar produtos por CSV</h1>
        <p>Use esta tela para atualizar catalogo e estoque sem mexer no codigo.</p>
      </div>

      {hasResult ? (
        <div className="admin-notice success" role="status">
          Importacao concluida: {created || 0} criados, {updated || 0} atualizados, {stock || 0} estoques sincronizados.
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}

      <form action={importProductsAction}>
        <AdminProductImportClient />
      </form>
    </AdminShell>
  );
}
