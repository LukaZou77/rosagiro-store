import Link from "next/link";
import { permanentlyDeleteProductsAction, restoreProductsFromTrashAction } from "@/app/admin/actions";
import { AdminProductTrashList, type AdminTrashProductRow } from "@/components/AdminProductTrashList";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { createAdminTranslator } from "@/lib/admin-i18n";
import { getAdminLocale } from "@/lib/admin-i18n-server";
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
  const [admin, params, products, locale] = await Promise.all([
    requireAdmin(),
    searchParams,
    prisma.product.findMany({
      where: { deletedAt: { not: null } },
      include: { brand: true, category: true },
      orderBy: [{ deletedAt: "desc" }, { updatedAt: "desc" }]
    }),
    getAdminLocale()
  ]);
  const t = createAdminTranslator(locale);
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
    deletedAt: formatAdminDateTime(product.deletedAt, t("data não registrada", "未记录日期"), locale),
    deletedBy: product.deletedByAdminEmail || t("admin não registrado", "未记录管理员"),
    deleteNote: product.deleteNote || ""
  }));

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">{t("Produtos", "商品")}</p>
        <h1>{t("Lixeira de produtos", "商品回收站")}</h1>
        <p>{t("Produtos nesta área ficam fora da loja e podem ser restaurados ou excluídos definitivamente.", "这里的商品已从前台下架，可恢复或永久删除。")}</p>
        <div className="admin-actions">
          <Link className="button secondary" href="/admin/produtos" prefetch={false}>
            {t("Voltar para produtos", "返回商品列表")}
          </Link>
        </div>
      </div>

      {restored ? (
        <div className="admin-notice success" role="status">
          {restored} {t("produto(s) restaurado(s) e publicado(s).", "个商品已恢复并上架。")}
        </div>
      ) : null}
      {deleted ? (
        <div className="admin-notice success" role="status">
          {deleted} {t("produto(s) excluído(s) definitivamente.", "个商品已永久删除。")}
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
          <strong>{t("Lixeira vazia", "回收站为空")}</strong>
          <p>{t("Nenhum produto foi removido. Use a central de produtos para mover itens para a lixeira.", "暂无已移除商品。请在商品管理中将商品移入回收站。")}</p>
          <Link className="button primary" href="/admin/produtos" prefetch={false}>
            {t("Ver produtos", "查看商品")}
          </Link>
        </div>
      )}
    </AdminShell>
  );
}
