import Link from "next/link";
import { saveSiteInfoPageAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { createAdminTranslator, type AdminLocale } from "@/lib/admin-i18n";
import { getAdminLocale } from "@/lib/admin-i18n-server";
import { formatAdminDateTime } from "@/lib/date-format";
import {
  getAllSiteInfoPages,
  siteInfoPageLabel,
  SITE_INFO_PAGE_SECTION_LIMIT,
  type SiteInfoPageEditable,
  type SiteInfoPageKey
} from "@/lib/site-info-pages";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageAnchor(pageKey: SiteInfoPageKey) {
  return `politica-${pageKey}`;
}

function PolicyEditor({ page, locale }: { page: SiteInfoPageEditable; locale: AdminLocale }) {
  const t = createAdminTranslator(locale);
  const sectionSlots = Array.from({ length: SITE_INFO_PAGE_SECTION_LIMIT }).map((_, index) => page.sections[index] || { title: "", body: "" });

  return (
    <form action={saveSiteInfoPageAction} className="import-panel policy-editor" id={pageAnchor(page.pageKey)}>
      <input type="hidden" name="pageKey" value={page.pageKey} />
      <div className="readiness-group-heading">
        <div>
          <span>{siteInfoPageLabel(page.pageKey)}</span>
          <h2>{page.title}</h2>
        </div>
        <Link className="button secondary" href={page.href} prefetch={false}>
          {t("Ver página", "查看前台页面")}
        </Link>
      </div>
      <p className="table-note">{t("Última atualização: ", "最近更新：")}{formatAdminDateTime(page.updatedAt, t("Conteúdo padrão", "默认内容"), locale)}{t(". Use texto simples, sem HTML.", "。请使用纯文本，不要填写 HTML。")}</p>

      <div className="form-grid">
        <label>
          {t("Chamada", "引导短语")}
          <input name="eyebrow" defaultValue={page.eyebrow} required />
        </label>
        <label>
          {t("Título", "标题")}
          <input name="title" defaultValue={page.title} required />
        </label>
      </div>
      <label>
        {t("Descrição", "描述")}
        <textarea name="description" defaultValue={page.description} required />
      </label>

      <div className="policy-section-list">
        {sectionSlots.map((section, index) => (
          <fieldset className="policy-section-editor" key={`${page.pageKey}-${index}`}>
            <legend>{t("Seção", "段落")} {index + 1}</legend>
            <label>
              {t("Título da seção", "段落标题")}
              <input name="sectionTitle" defaultValue={section.title} />
            </label>
            <label>
              {t("Texto da seção", "段落正文")}
              <textarea name="sectionBody" defaultValue={section.body} />
            </label>
          </fieldset>
        ))}
      </div>
      <button className="button primary wide" type="submit">
        {t("Salvar", "保存")} {siteInfoPageLabel(page.pageKey)}
      </button>
    </form>
  );
}
export default async function AdminPoliciesPage({ searchParams }: PageProps) {
  const [admin, params, pages, locale] = await Promise.all([requireAdmin(), searchParams, getAllSiteInfoPages(), getAdminLocale()]);
  const t = createAdminTranslator(locale);
  const saved = single(params.saved);
  const error = single(params.error);
  const activePage = single(params.pagina);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">{t("Políticas / Conteúdo", "政策 / 内容")}</p>
        <h1>{t("Páginas públicas editáveis", "可编辑的前台页面")}</h1>
        <p>
          {t("Ajuste os textos de privacidade, termos, trocas, entrega e contato. O conteúdo salvo aparece na loja imediatamente e continua marcado para revisão antes da venda real.", "编辑隐私、条款、退换、配送和联系信息。保存后会立即显示在前台，正式销售前仍应人工复核。")}
        </p>
      </div>

      {saved ? (
        <div className="admin-notice success" role="status">
          {t("Conteúdo salvo e publicado.", "内容已保存并发布。")}
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="admin-notice">
        {t("Estas páginas usam texto simples. Não cole HTML, tokens, chaves de API ou dados sensíveis de ambiente.", "这些页面使用纯文本。请勿粘贴 HTML、令牌、API 密钥或环境敏感数据。")}
      </section>

      <div className="admin-actions policy-jump-list" aria-label={t("Atalhos para páginas editáveis", "可编辑页面快捷入口")}>
        {pages.map((page) => (
          <Link
            className={activePage === page.pageKey ? "button primary" : "button secondary"}
            href={`/admin/politicas?pagina=${page.pageKey}#${pageAnchor(page.pageKey)}`}
            prefetch={false}
            key={page.pageKey}
          >
            {siteInfoPageLabel(page.pageKey)}
          </Link>
        ))}
      </div>

      <div className="policy-editor-list">
        {pages.map((page) => (
          <PolicyEditor key={page.pageKey} page={page} locale={locale} />
        ))}
      </div>
    </AdminShell>
  );
}
