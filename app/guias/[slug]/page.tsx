import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OptimizedProductImage } from "@/components/OptimizedProductImage";
import { StoreShell } from "@/components/StoreShell";
import { StructuredData } from "@/components/StructuredData";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { getCategories } from "@/lib/catalog";
import { getGuideArticleBySlug, guideBodyParagraphs, getPublishedGuideArticles } from "@/lib/guide-articles";
import { breadcrumbJsonLd, guideArticleJsonLd, noIndexMetadata, storefrontMetadata } from "@/lib/seo";
import { getStoreProfile } from "@/lib/store-profile";
import { formatDatePtBr } from "@/lib/date-format";
import { buildGeneralWhatsAppHref } from "@/lib/whatsapp";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getGuideArticleBySlug(slug);
  if (!article) {
    return noIndexMetadata("Guia não encontrado", "Guia RosaGiro indisponível.");
  }

  return storefrontMetadata({
    title: article.title,
    description: article.excerpt,
    path: `/guias/${article.slug}`,
    image: article.coverImage,
    type: "article"
  });
}

export async function generateStaticParams() {
  const articles = await getPublishedGuideArticles();
  return articles.map((article) => ({ slug: article.slug }));
}

export default async function GuideArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const [categories, article, storeProfile] = await Promise.all([
    getCategories(),
    getGuideArticleBySlug(slug),
    getStoreProfile()
  ]);

  if (!article) notFound();

  const whatsappHref = buildGeneralWhatsAppHref(`guia ${article.title}`, storeProfile.whatsapp);
  const paragraphs = guideBodyParagraphs(article.body);

  return (
    <StoreShell categories={categories}>
      <StructuredData
        data={[
          guideArticleJsonLd(article),
          breadcrumbJsonLd([
            { name: "Início", path: "/" },
            { name: "Guias", path: "/guias" },
            { name: article.title, path: `/guias/${article.slug}` }
          ])
        ]}
      />
      <article className="guide-article">
        <header className="guide-article-header">
          <p className="eyebrow">Guia RosaGiro</p>
          <h1>{article.title}</h1>
          <p>{article.excerpt}</p>
          <div className="hero-actions">
            <Link className="button primary" href="/categoria/all">
              Ver catálogo
            </Link>
            <WhatsAppLink className="button whatsapp" href={whatsappHref}>
              Tirar dúvida no WhatsApp
            </WhatsAppLink>
          </div>
        </header>

        {article.coverImage ? (
          <div className="guide-article-cover">
            <OptimizedProductImage
              src={article.coverImage}
              alt={article.coverImageAlt || article.title}
              fill
              priority
              sizes="(min-width: 960px) 74vw, 92vw"
            />
          </div>
        ) : null}

        <div className="guide-article-body">
          {paragraphs.map((paragraph, index) => (
            <p key={`${article.slug}-${index}`}>{paragraph}</p>
          ))}
        </div>

        <aside className="guide-article-editorial" aria-label="Informacoes editoriais">
          <h2>Como este guia foi preparado</h2>
          <dl>
            <div>
              <dt>Autor</dt>
              <dd>{article.authorName || "Equipe RosaGiro"}</dd>
            </div>
            {article.reviewerName && article.reviewedAt ? (
              <div>
                <dt>Revisao</dt>
                <dd>
                  {article.reviewerName} em {formatDatePtBr(article.reviewedAt)}
                </dd>
              </div>
            ) : null}
            {article.sourceNotes ? (
              <div>
                <dt>Fontes e verificacao</dt>
                <dd className="guide-source-notes">{article.sourceNotes}</dd>
              </div>
            ) : null}
            <div>
              <dt>Atualizacao</dt>
              <dd>{formatDatePtBr(article.updatedAt)}</dd>
            </div>
          </dl>
        </aside>

        <footer className="guide-article-footer">
          <strong>Quer montar pedido com orientação?</strong>
          <p>Use o catálogo para combinar produtos e chame o atendimento para confirmar estoque, lote, validade e entrega.</p>
          <div className="hero-actions">
            <Link className="button primary" href="/categoria/all">
              Comprar pelo catálogo
            </Link>
            <WhatsAppLink className="button secondary" href={whatsappHref}>
              Falar com atendimento
            </WhatsAppLink>
          </div>
        </footer>
      </article>
    </StoreShell>
  );
}
