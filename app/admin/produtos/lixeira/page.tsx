import Link from "next/link";
import { permanentlyDeleteProductsAction, restoreProductsFromTrashAction } from "@/app/admin/actions";
import { AdminProductTrashList, type AdminTrashProductRow } from "@/components/AdminProductTrashList";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { formatAdminDateTime } from "@/lib/date-format";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminProductTrashPage({ searchParams }: PageProps) {
  const [admin, params, products] = await Promise.all([
    requireAdmin(),
    searchParams,
    prisma.product.findMany({
      where: { deletedAt: { not: null } },
      include: { brand: true, category: true },
      orderBy: [{ deletedAt: "desc" }, { updatedAt: "desc" }]
    })
  ]);
  const restored = single(params.restored);
  const deleted = single(params.deleted);
  const error = single(params.error);
  const rows: AdminTrashProductRow[] = products.map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    image: product.image,
    brandName: product.brand.name,
    categoryLabel: product.category.label,
    price: money(product.priceCents),
    deletedAt: formatAdminDateTime(product.deletedAt, "data não registrada"),
    deletedBy: product.deletedByAdminEmail || "admin não registrado",
    deleteNote: product.deleteNote || ""
  }));

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Produtos</p>
        <h1>Lixeira de produtos</h1>
        <p>Produtos nesta área ficam fora da loja e podem ser restaurados ou excluídos definitivamente.</p>
        <div className="admin-actions">
          <Link className="button secondary" href="/admin/produtos">
            Voltar para produtos
          </Link>
        </div>
      </div>

      {restored ? (
        <div className="admin-notice success" role="status">
          {restored} produto(s) restaurado(s) e publicado(s).
        </div>
      ) : null}
      {deleted ? (
        <div className="admin-notice success" role="status">
          {deleted} produto(s) excluído(s) definitivamente.
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}

      {rows.length ? (
        <AdminProductTrashList
          products={rows}
          restoreAction={restoreProductsFromTrashAction}
          permanentDeleteAction={permanentlyDeleteProductsAction}
        />
      ) : (
        <div className="empty-state">
          <strong>Lixeira vazia</strong>
          <p>Nenhum produto foi removido. Use a central de produtos para mover itens para a lixeira.</p>
          <Link className="button primary" href="/admin/produtos">
            Ver produtos
          </Link>
        </div>
      )}
    </AdminShell>
  );
}
