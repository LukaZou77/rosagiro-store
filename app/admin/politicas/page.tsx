import Link from "next/link";
import { saveSiteInfoPageAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
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

function PolicyEditor({ page }: { page: SiteInfoPageEditable }) {
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
          Ver página
        </Link>
      </div>
      <p className="table-note">Última atualização: {formatAdminDateTime(page.updatedAt, "Conteúdo padrão")}. Use texto simples, sem HTML.</p>

      <div className="form-grid">
        <label>
          Chamada
          <input name="eyebrow" defaultValue={page.eyebrow} required />
        </label>
        <label>
          Título
          <input name="title" defaultValue={page.title} required />
        </label>
      </div>
      <label>
        Descrição
        <textarea name="description" defaultValue={page.description} required />
      </label>

      <div className="policy-section-list">
        {sectionSlots.map((section, index) => (
          <fieldset className="policy-section-editor" key={`${page.pageKey}-${index}`}>
            <legend>Seção {index + 1}</legend>
            <label>
              Título da seção
              <input name="sectionTitle" defaultValue={section.title} />
            </label>
            <label>
              Texto da seção
              <textarea name="sectionBody" defaultValue={section.body} />
            </label>
          </fieldset>
        ))}
      </div>
      <button className="button primary wide" type="submit">
        Salvar {siteInfoPageLabel(page.pageKey)}
      </button>
    </form>
  );
}
export default async function AdminPoliciesPage({ searchParams }: PageProps) {
  const [admin, params, pages] = await Promise.all([requireAdmin(), searchParams, getAllSiteInfoPages()]);
  const saved = single(params.saved);
  const error = single(params.error);
  const activePage = single(params.pagina);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Políticas / Conteúdo</p>
        <h1>Páginas públicas editáveis</h1>
        <p>
          Ajuste os textos de privacidade, termos, trocas, entrega e contato. O conteúdo salvo aparece na loja
          imediatamente e continua marcado para revisão antes da venda real.
        </p>
      </div>

      {saved ? (
        <div className="admin-notice success" role="status">
          Conteúdo salvo e publicado.
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="admin-notice">
        Estas páginas usam texto simples. Não cole HTML, tokens, chaves de API ou dados sensíveis de ambiente.
      </section>

      <div className="admin-actions policy-jump-list" aria-label="Atalhos para páginas editáveis">
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
          <PolicyEditor key={page.pageKey} page={page} />
        ))}
      </div>
    </AdminShell>
  );
}
