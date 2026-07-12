import Link from "next/link";
import { notFound } from "next/navigation";
import { restoreProductsFromTrashAction, updateProductDetailAction } from "@/app/admin/actions";
import { AdminProductForm } from "@/components/AdminProductForm";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { createAdminTranslator } from "@/lib/admin-i18n";
import {
  adminQualityGroupLabel,
  adminQualityIssueLabel,
  adminQualityStatusLabel,
  adminQualityStatusMessage
} from "@/lib/admin-i18n-content";
import { getAdminLocale } from "@/lib/admin-i18n-server";
import { prisma } from "@/lib/db";
import { evaluateProductQuality, productQualityGroupLabels } from "@/lib/product-quality";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminProductDetailPage({ params, searchParams }: PageProps) {
  const [{ slug }, admin, query, brands, categories, locale] = await Promise.all([
    params,
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
  const product = await prisma.product.findUnique({
    where: { slug },
    include: { brand: true, category: true, inventory: true, skus: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } }
  });
  if (!product) notFound();

  const error = single(query.error);
  const saved = single(query.saved);

  if (product.deletedAt) {
    return (
      <AdminShell adminName={admin.name}>
        <div className="admin-heading">
          <p className="eyebrow">{t("Produto na lixeira", "回收站商品")}</p>
          <h1>{product.name}</h1>
          <p>{t("Este produto está fora da loja. Restaure para publicar e editar novamente.", "该商品已从前台下架。恢复后才能重新编辑和上架。")}</p>
          <div className="admin-actions">
            <Link className="button secondary" href="/admin/produtos/lixeira" prefetch={false}>
              {t("Voltar para lixeira", "返回回收站")}
            </Link>
            <form action={restoreProductsFromTrashAction}>
              <input type="hidden" name="productIds" value={product.id} />
              <button className="button primary" type="submit">
                {t("Restaurar e publicar", "恢复并上架")}
              </button>
            </form>
          </div>
        </div>
        {error ? (
          <div className="admin-notice error" role="alert">
            {error}
          </div>
        ) : null}
        <section className="import-panel">
          <div className="readiness-group-heading">
            <div>
              <span>{product.slug}</span>
              <h2>{t("Ficha preservada", "商品资料已保留")}</h2>
            </div>
            <strong>{t("Lixeira", "回收站")}</strong>
          </div>
          <p className="table-note">
            {t("A ficha, galeria e estoque continuam salvos para restauração. A exclusão definitiva fica disponível na lixeira de produtos.", "商品资料、图库和库存仍保留，可随时恢复。永久删除操作仅在商品回收站中提供。")}
          </p>
        </section>
      </AdminShell>
    );
  }

  const quality = evaluateProductQuality(product);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">{t("Ficha de produto", "商品资料")}</p>
        <h1>{product.name}</h1>
        <p>{t("Edite a ficha completa que alimenta a vitrine, filtros, importação e checkout.", "编辑用于前台展示、筛选、导入和结账的完整商品资料。")}</p>
        <div className="admin-actions">
          <Link className="button secondary" href="/admin/produtos" prefetch={false}>
            {t("Voltar para produtos", "返回商品列表")}
          </Link>
          <Link className="button secondary" href={`/produto/${product.slug}`} prefetch={false}>
            {t("Ver na loja", "查看前台")}
          </Link>
        </div>
      </div>

      {saved ? (
        <div className="admin-notice success" role="status">
          {t("Produto salvo com sucesso.", "商品保存成功。")}
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}

      <section className={`import-panel quality-editor-panel ${quality.status.toLowerCase().replace("_", "-")}`}>
        <div className="readiness-group-heading">
          <div>
            <span>{t("Qualidade da ficha", "资料质量")}</span>
            <h2>{adminQualityStatusLabel(quality.status, quality.statusLabel, locale)}</h2>
          </div>
          <strong>{quality.issues.length}</strong>
        </div>
        <p className="table-note">{adminQualityStatusMessage(quality.status, quality.statusMessage, locale)}</p>
        {quality.issues.length ? (
          <div className="quality-row-issues expanded">
            {quality.issues.map((issue) => (
              <span className={`quality-mini-issue ${issue.severity}`} key={issue.key}>
                {adminQualityGroupLabel(issue.group, productQualityGroupLabels[issue.group], locale)}: {adminQualityIssueLabel(issue.key, issue.label, locale)}
              </span>
            ))}
          </div>
        ) : (
          <div className="admin-notice success">{t("Nenhum alerta automático encontrado para este produto.", "该商品未发现自动检查提醒。")}</div>
        )}
        <div className="admin-actions">
          <Link className="button secondary" href="/admin/produtos/qualidade" prefetch={false}>
            {t("Ver central de qualidade", "打开质量检查")}
          </Link>
        </div>
      </section>

      <AdminProductForm action={updateProductDetailAction} brands={brands} categories={categories} locale={locale} mode="edit" product={product} />
    </AdminShell>
  );
}
