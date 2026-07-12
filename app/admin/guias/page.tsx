import Link from "next/link";
import { deleteGuideArticleAction, saveGuideArticleAction } from "@/app/admin/actions";
import { AdminGuideDeleteButton } from "@/components/AdminGuideDeleteButton";
import { AdminShell } from "@/components/AdminShell";
import { OptimizedProductImage } from "@/components/OptimizedProductImage";
import { requireAdmin } from "@/lib/auth";
import { createAdminTranslator, type AdminLocale } from "@/lib/admin-i18n";
import { getAdminLocale } from "@/lib/admin-i18n-server";
import { formatAdminDateTime } from "@/lib/date-format";
import { getAdminGuideArticles } from "@/lib/guide-articles";
import type { GuideArticle } from "@/src/generated/prisma/client";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function GuideEditor({ article, locale }: { article?: GuideArticle; locale: AdminLocale }) {
  const t = createAdminTranslator(locale);
  const isNew = !article;
  const formId = article ? `guide-${article.id}` : "guide-new";

  return (
    <form action={saveGuideArticleAction} className="import-panel policy-editor guide-editor" encType="multipart/form-data" id={formId}>
      {article ? <input type="hidden" name="id" value={article.id} /> : null}
      <div className="readiness-group-heading">
        <div>
          <span>{isNew ? t("Novo guia", "新建指南") : article.active ? t("Publicado", "已发布") : t("Rascunho", "草稿")}</span>
          <h2>{article?.title || t("Criar guia / artigo", "创建指南 / 文章")}</h2>
        </div>
        <div className="admin-actions">
          {article?.active ? (
            <Link className="button secondary" href={`/guias/${article.slug}`} prefetch={false}>
              {t("Ver guia", "查看前台文章")}
            </Link>
          ) : null}
          {article ? <AdminGuideDeleteButton action={deleteGuideArticleAction} /> : null}
        </div>
      </div>
      <p className="table-note">
        {article
          ? `${t("Ultima atualizacao: ", "最近更新：")}${formatAdminDateTime(article.updatedAt, t("Conteudo em preparacao", "内容准备中"), locale)}${t(". ", "。")}`
          : t("Use guias para SEO, atendimento e compra consciente no atacado.", "指南可用于 SEO、客户服务和批发采购决策。")}{" "}
        {t("Use texto simples, sem HTML. Para publicar, informe autor, revisao humana, data e fontes ou criterio de verificacao.", "请使用纯文本，不要填写 HTML。发布前必须填写作者、人工审核、日期及来源或核验标准。")}
      </p>

      <div className="form-grid">
        <label>
          {t("Titulo", "标题")}
          <input name="title" defaultValue={article?.title || ""} placeholder={t("Ex: Como montar pedido de maquiagem para revenda", "例如：Como montar pedido de maquiagem para revenda")} required />
        </label>
        <label>
          Slug
          <input name="slug" defaultValue={article?.slug || ""} placeholder={t("gerado pelo titulo se ficar vazio", "留空时根据标题自动生成")} />
        </label>
      </div>

      <div className="form-grid">
        <label>
          {t("Ordem", "排序")}
          <input min="0" name="sortOrder" type="number" defaultValue={article?.sortOrder || 0} />
        </label>
        <label className="checkbox-label admin-checkbox-field">
          <input name="active" type="checkbox" defaultChecked={article?.active || false} />
          {t("Publicar guia na loja", "发布到前台")}
        </label>
      </div>

      <label>
        {t("Resumo", "摘要")}
        <textarea
          name="excerpt"
          defaultValue={article?.excerpt || ""}
          maxLength={280}
          placeholder={t("Resumo curto para cards, SEO e compartilhamento.", "用于卡片、SEO 和分享的简短摘要。")}
          required
        />
      </label>

      <div className="form-grid">
        <label>
          {t("Autor responsavel", "作者")}
          <input name="authorName" defaultValue={article?.authorName || ""} maxLength={120} placeholder="Ex: Equipe RosaGiro" />
        </label>
        <label>
          {t("Revisado por", "审核人")}
          <input name="reviewerName" defaultValue={article?.reviewerName || ""} maxLength={120} placeholder={t("Nome da pessoa responsavel pela revisao", "填写负责人姓名")} />
        </label>
      </div>

      <label>
        {t("Data da revisao humana", "人工审核日期")}
        <input name="reviewedAt" type="date" defaultValue={article?.reviewedAt?.toISOString().slice(0, 10) || ""} />
      </label>

      <div className="form-grid guide-cover-grid">
        <label>
          {t("URL da capa", "封面 URL")}
          <input name="coverImage" defaultValue={article?.coverImage || ""} placeholder="/uploads/guides/... ou https://..." />
        </label>
        <label>
          {t("Enviar nova capa", "上传新封面")}
          <input accept="image/jpeg,image/png,image/webp" name="coverFile" type="file" />
        </label>
      </div>
      <label>
        {t("Descricao da capa", "封面图片说明")}
        <input
          name="coverImageAlt"
          defaultValue={article?.coverImageAlt || ""}
          maxLength={180}
          placeholder={t("Descreva apenas o que aparece de fato na imagem.", "只描述图片中真实出现的内容。")}
        />
      </label>
      {article?.coverImage ? (
        <div className="guide-cover-preview">
          <OptimizedProductImage src={article.coverImage} alt={article.coverImageAlt || article.title} width={320} height={180} sizes="220px" />
          <span>{t("Imagem atual de capa", "当前封面")}</span>
        </div>
      ) : null}

      <label>
        {t("Conteudo do guia", "指南正文")}
        <textarea
          className="guide-body-input"
          name="body"
          defaultValue={article?.body || ""}
          placeholder={t("Escreva em paragrafos. Separe os blocos com uma linha em branco.\n\nEx: O que conferir antes de comprar no atacado...", "请分段填写，段落之间空一行。\n\n例如：O que conferir antes de comprar no atacado...")}
          required
        />
      </label>

      <label>
        {t("Fontes e criterio de verificacao", "来源与核验标准")}
        <textarea
          name="sourceNotes"
          defaultValue={article?.sourceNotes || ""}
          maxLength={2400}
          placeholder={t("Ex: Conferencia do rotulo, catalogo do fabricante e estoque RosaGiro em 10/07/2026. Inclua links ou referencias quando houver.", "例如：核对包装标签、厂家目录和 RosaGiro 2026/07/10 库存；如有链接或参考资料请一并填写。")}
        />
      </label>

      <button className="button primary wide" type="submit">
        {isNew ? t("Criar guia", "创建指南") : t("Salvar guia", "保存指南")}
      </button>
    </form>
  );
}

export default async function AdminGuidesPage({ searchParams }: PageProps) {
  const [admin, params, articles, locale] = await Promise.all([requireAdmin(), searchParams, getAdminGuideArticles(), getAdminLocale()]);
  const t = createAdminTranslator(locale);
  const saved = single(params.saved);
  const deleted = single(params.deleted);
  const error = single(params.error);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">{t("Guias / Artigos", "指南 / 文章")}</p>
        <h1>{t("Conteudo editorial da loja", "店铺内容管理")}</h1>
        <p>
          {t("Publique guias de compra, revenda, categorias e cuidados para ajudar clientes a escolher produtos e melhorar o SEO da RosaGiro.", "发布采购、转售、品类与护理指南，帮助客户选品并提升 RosaGiro SEO。")}
        </p>
      </div>

      {saved ? (
        <div className="admin-notice success" role="status">
          {t("Guia salvo.", "指南已保存。")} {saved ? <Link href={`/guias/${saved}`} prefetch={false}>{t("Ver pagina publicada", "查看已发布页面")}</Link> : null}
        </div>
      ) : null}
      {deleted ? (
        <div className="admin-notice success" role="status">
          {t("Guia excluido.", "指南已删除。")}
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="admin-notice">
        {t("Guias aceitam capa JPG/PNG/WebP de ate 5MB. Use fotos reais de produtos ou da operacao e descreva exatamente o que aparece. Mantenha o texto em portugues do Brasil, sem HTML, sem token e sem dados sensiveis.", "指南封面支持最大 5MB 的 JPG/PNG/WebP。请使用真实商品或运营照片，并准确描述图片内容。正文必须保持巴西葡语，不得包含 HTML、令牌或敏感数据。")}
      </section>

      <div className="policy-editor-list">
        <GuideEditor locale={locale} />
        {articles.map((article) => (
          <GuideEditor article={article} locale={locale} key={article.id} />
        ))}
      </div>
    </AdminShell>
  );
}
