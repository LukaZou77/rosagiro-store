import Link from "next/link";
import { saveSiteInfoPageAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
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

function dateLabel(value?: Date | null) {
  if (!value) return "Conteudo padrao";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(value);
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
        <Link className="button secondary" href={page.href}>
          Ver pagina
        </Link>
      </div>
      <p className="table-note">Ultima atualizacao: {dateLabel(page.updatedAt)}. Use texto simples, sem HTML.</p>

      <div className="form-grid">
        <label>
          Chamada
          <input name="eyebrow" defaultValue={page.eyebrow} required />
        </label>
        <label>
          Titulo
          <input name="title" defaultValue={page.title} required />
        </label>
      </div>
      <label>
        Descricao
        <textarea name="description" defaultValue={page.description} required />
      </label>

      <div className="policy-section-list">
        {sectionSlots.map((section, index) => (
          <fieldset className="policy-section-editor" key={`${page.pageKey}-${index}`}>
            <legend>Secao {index + 1}</legend>
            <label>
              Titulo da secao
              <input name="sectionTitle" defaultValue={section.title} />
            </label>
            <label>
              Texto da secao
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
        <p className="eyebrow">Politicas / Conteudo</p>
        <h1>Paginas publicas editaveis</h1>
        <p>
          Ajuste os textos de privacidade, termos, trocas, entrega e contato. O conteudo salvo aparece na loja
          imediatamente e continua marcado para revisao antes da venda real.
        </p>
      </div>

      {saved ? (
        <div className="admin-notice success" role="status">
          Conteudo salvo e publicado.
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="admin-notice">
        Estas paginas usam texto simples. Nao cole HTML, tokens, chaves de API ou dados sensiveis de ambiente.
      </section>

      <div className="admin-actions policy-jump-list" aria-label="Atalhos para paginas editaveis">
        {pages.map((page) => (
          <Link
            className={activePage === page.pageKey ? "button primary" : "button secondary"}
            href={`/admin/politicas?pagina=${page.pageKey}#${pageAnchor(page.pageKey)}`}
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
