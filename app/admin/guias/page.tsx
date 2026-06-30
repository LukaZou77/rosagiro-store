import Link from "next/link";
import { deleteGuideArticleAction, saveGuideArticleAction } from "@/app/admin/actions";
import { AdminGuideDeleteButton } from "@/components/AdminGuideDeleteButton";
import { AdminShell } from "@/components/AdminShell";
import { OptimizedProductImage } from "@/components/OptimizedProductImage";
import { requireAdmin } from "@/lib/auth";
import { formatAdminDateTime } from "@/lib/date-format";
import { getAdminGuideArticles } from "@/lib/guide-articles";
import type { GuideArticle } from "@/src/generated/prisma/client";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function GuideEditor({ article }: { article?: GuideArticle }) {
  const isNew = !article;
  const formId = article ? `guide-${article.id}` : "guide-new";

  return (
    <form action={saveGuideArticleAction} className="import-panel policy-editor guide-editor" encType="multipart/form-data" id={formId}>
      {article ? <input type="hidden" name="id" value={article.id} /> : null}
      <div className="readiness-group-heading">
        <div>
          <span>{isNew ? "Novo guia" : article.active ? "Publicado" : "Rascunho"}</span>
          <h2>{article?.title || "Criar guia / artigo"}</h2>
        </div>
        <div className="admin-actions">
          {article?.active ? (
            <Link className="button secondary" href={`/guias/${article.slug}`}>
              Ver guia
            </Link>
          ) : null}
          {article ? <AdminGuideDeleteButton action={deleteGuideArticleAction} /> : null}
        </div>
      </div>
      <p className="table-note">
        {article
          ? `Ultima atualizacao: ${formatAdminDateTime(article.updatedAt, "Conteudo em preparacao")}.`
          : "Use guias para SEO, atendimento e compra consciente no atacado."}{" "}
        Use texto simples, sem HTML.
      </p>

      <div className="form-grid">
        <label>
          Titulo
          <input name="title" defaultValue={article?.title || ""} placeholder="Ex: Como montar pedido de maquiagem para revenda" required />
        </label>
        <label>
          Slug
          <input name="slug" defaultValue={article?.slug || ""} placeholder="gerado pelo titulo se ficar vazio" />
        </label>
      </div>

      <div className="form-grid">
        <label>
          Ordem
          <input min="0" name="sortOrder" type="number" defaultValue={article?.sortOrder || 0} />
        </label>
        <label className="checkbox-label admin-checkbox-field">
          <input name="active" type="checkbox" defaultChecked={article?.active || false} />
          Publicar guia na loja
        </label>
      </div>

      <label>
        Resumo
        <textarea
          name="excerpt"
          defaultValue={article?.excerpt || ""}
          maxLength={280}
          placeholder="Resumo curto para cards, SEO e compartilhamento."
          required
        />
      </label>

      <div className="form-grid guide-cover-grid">
        <label>
          URL da capa
          <input name="coverImage" defaultValue={article?.coverImage || ""} placeholder="/uploads/guides/... ou https://..." />
        </label>
        <label>
          Enviar nova capa
          <input accept="image/jpeg,image/png,image/webp" name="coverFile" type="file" />
        </label>
      </div>
      {article?.coverImage ? (
        <div className="guide-cover-preview">
          <OptimizedProductImage src={article.coverImage} alt={article.title} width={320} height={180} sizes="220px" />
          <span>Imagem atual de capa</span>
        </div>
      ) : null}

      <label>
        Conteudo do guia
        <textarea
          className="guide-body-input"
          name="body"
          defaultValue={article?.body || ""}
          placeholder={"Escreva em paragrafos. Separe os blocos com uma linha em branco.\n\nEx: O que conferir antes de comprar no atacado..."}
          required
        />
      </label>

      <button className="button primary wide" type="submit">
        {isNew ? "Criar guia" : "Salvar guia"}
      </button>
    </form>
  );
}

export default async function AdminGuidesPage({ searchParams }: PageProps) {
  const [admin, params, articles] = await Promise.all([requireAdmin(), searchParams, getAdminGuideArticles()]);
  const saved = single(params.saved);
  const deleted = single(params.deleted);
  const error = single(params.error);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Guias / Artigos</p>
        <h1>Conteudo editorial da loja</h1>
        <p>
          Publique guias de compra, revenda, categorias e cuidados para ajudar clientes a escolher produtos e melhorar o SEO da RosaGiro.
        </p>
      </div>

      {saved ? (
        <div className="admin-notice success" role="status">
          Guia salvo. {saved ? <Link href={`/guias/${saved}`}>Ver pagina publicada</Link> : null}
        </div>
      ) : null}
      {deleted ? (
        <div className="admin-notice success" role="status">
          Guia excluido.
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="admin-notice">
        Guias aceitam capa JPG/PNG/WebP de ate 5MB. Mantenha o texto em portugues do Brasil, sem HTML, sem token e sem dados sensiveis.
      </section>

      <div className="policy-editor-list">
        <GuideEditor />
        {articles.map((article) => (
          <GuideEditor article={article} key={article.id} />
        ))}
      </div>
    </AdminShell>
  );
}
