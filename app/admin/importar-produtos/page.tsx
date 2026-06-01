import Link from "next/link";
import { importProductsAction } from "@/app/admin/actions";
import { AdminProductImportClient } from "@/components/AdminProductImportClient";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { getProductImportExistingProducts } from "@/lib/product-import";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminProductImportPage({ searchParams }: PageProps) {
  const [admin, params, existingProducts] = await Promise.all([
    requireAdmin(),
    searchParams,
    getProductImportExistingProducts()
  ]);
  const error = single(params.error);
  const created = single(params.created);
  const updated = single(params.updated);
  const stock = single(params.stock);
  const hasResult = created || updated || stock;

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Importacao</p>
        <h1>Importar / exportar produtos</h1>
        <p>Use CSV para gravar no banco e XLSX como planilha editavel para organizar dados reais.</p>
        <div className="admin-actions">
          <Link className="button secondary" href="/admin/importar-produtos/modelo-csv" prefetch={false}>
            Baixar CSV modelo
          </Link>
          <Link className="button secondary" href="/admin/importar-produtos/modelo-xlsx" prefetch={false}>
            Baixar XLSX modelo
          </Link>
          <Link className="button secondary" href="/admin/produtos/exportar" prefetch={false}>
            Exportar catalogo CSV
          </Link>
        </div>
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
        <AdminProductImportClient existingProducts={existingProducts} />
      </form>
    </AdminShell>
  );
}
