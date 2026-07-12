import Link from "next/link";
import { createProductAction } from "@/app/admin/actions";
import { AdminProductForm } from "@/components/AdminProductForm";
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

export default async function AdminNewProductPage({ searchParams }: PageProps) {
  const [admin, query, brands, categories, locale] = await Promise.all([
    requireAdmin(),
    searchParams,
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({
      include: { subcategories: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } },
      orderBy: { label: "asc" }
    }),
    getAdminLocale()
  ]);
  const t = createAdminTranslator(locale);
  const error = single(query.error);
  const hasCatalogSetup = brands.length > 0 && categories.some((category) => category.subcategories.length > 0);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">{t("Novo produto", "新建商品")}</p>
        <h1>{t("Cadastrar produto manualmente", "手动创建商品")}</h1>
        <p>{t("Crie uma ficha completa para publicar um novo item sem importar CSV.", "无需导入 CSV，直接填写完整资料并创建新商品。")}</p>
        <div className="admin-actions">
          <Link className="button secondary" href="/admin/produtos" prefetch={false}>
            {t("Voltar para produtos", "返回商品列表")}
          </Link>
          <Link className="button secondary" href="/admin/marcas" prefetch={false}>
            {t("Marcas", "品牌")}
          </Link>
          <Link className="button secondary" href="/admin/categorias" prefetch={false}>
            {t("Categorias", "品类")}
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
          {t("Cadastre pelo menos uma marca, uma categoria e uma subcategoria antes de criar produtos manuais.", "手动创建商品前，请至少创建一个品牌、一个品类和一个子品类。")}
        </div>
      ) : null}

      <section className="import-panel new-product-guidance">
        <div className="readiness-group-heading">
          <div>
            <span>{t("Publicação", "发布")}</span>
            <h2>{t("Salvar já sincroniza com a loja", "保存后会同步到前台")}</h2>
          </div>
          <strong>1</strong>
        </div>
        <p className="table-note">
          {t("Produto ativo aparece na vitrine depois de salvar. Para preparar sem publicar, desmarque Produto ativo e revise na central de qualidade antes de liberar.", "启用状态的商品保存后会显示在前台。如需先准备但不发布，请取消“启用商品”，并在质量检查中确认后再上架。")}
        </p>
      </section>

      <AdminProductForm action={createProductAction} brands={brands} categories={categories} locale={locale} mode="create" />
    </AdminShell>
  );
}
