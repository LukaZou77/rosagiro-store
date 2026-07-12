import Link from "next/link";
import { importProductsAction } from "@/app/admin/actions";
import { AdminProductImportClient } from "@/components/AdminProductImportClient";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { createAdminTranslator } from "@/lib/admin-i18n";
import { getAdminLocale } from "@/lib/admin-i18n-server";
import { getProductImportExistingProducts } from "@/lib/product-import";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminProductImportPage({ searchParams }: PageProps) {
  const [admin, params, existingProducts, locale] = await Promise.all([
    requireAdmin(),
    searchParams,
    getProductImportExistingProducts(),
    getAdminLocale()
  ]);
  const t = createAdminTranslator(locale);
  const error = single(params.error);
  const created = single(params.created);
  const updated = single(params.updated);
  const stock = single(params.stock);
  const hasResult = created || updated || stock;

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">{t("Importação", "导入")}</p>
        <h1>{t("Importar / exportar produtos", "导入 / 导出商品")}</h1>
        <p>{t("Use CSV para gravar no banco e XLSX como planilha editável para organizar dados reais.", "使用 CSV 写入数据库，使用可编辑 XLSX 整理真实商品资料。")}</p>
        <div className="admin-actions">
          <Link className="button secondary" href="/admin/importar-produtos/modelo-csv" prefetch={false}>
            {t("Baixar CSV modelo", "下载 CSV 模板")}
          </Link>
          <Link className="button secondary" href="/admin/importar-produtos/modelo-xlsx" prefetch={false}>
            {t("Baixar XLSX modelo", "下载 XLSX 模板")}
          </Link>
          <Link className="button secondary" href="/admin/produtos/exportar" prefetch={false}>
            {t("Exportar catálogo CSV", "导出商品目录 CSV")}
          </Link>
        </div>
      </div>

      {hasResult ? (
        <div className="admin-notice success" role="status">
          {t("Importação concluída", "导入完成")}：{created || 0} {t("criados", "个新建")}，{updated || 0} {t("atualizados", "个更新")}，{stock || 0} {t("disponibilidades sincronizadas", "个库存状态已同步")}。
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
