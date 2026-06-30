import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OptimizedProductImage } from "@/components/OptimizedProductImage";
import { StoreShell } from "@/components/StoreShell";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { getCategories } from "@/lib/catalog";
import { getGuideArticleBySlug, guideBodyParagraphs, getPublishedGuideArticles } from "@/lib/guide-articles";
import { siteUrl } from "@/lib/site-config";
import { getStoreProfile } from "@/lib/store-profile";
import { buildGeneralWhatsAppHref } from "@/lib/whatsapp";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getGuideArticleBySlug(slug);
  if (!article) {
    return {
      title: "Guia nao encontrado | RosaGiro"
    };
  }

  return {
    title: `${article.title} | RosaGiro`,
    description: article.excerpt,
    alternates: {
      canonical: siteUrl(`/guias/${article.slug}`)
    },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: article.coverImage ? [article.coverImage] : undefined,
      url: siteUrl(`/guias/${article.slug}`)
    }
  };
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
      <article className="guide-article">
        <header className="guide-article-header">
          <p className="eyebrow">Guia RosaGiro</p>
          <h1>{article.title}</h1>
          <p>{article.excerpt}</p>
          <div className="hero-actions">
            <Link className="button primary" href="/categoria/all">
              Ver catalogo
            </Link>
            <WhatsAppLink className="button whatsapp" href={whatsappHref}>
              Tirar duvida no WhatsApp
            </WhatsAppLink>
          </div>
        </header>

        {article.coverImage ? (
          <div className="guide-article-cover">
            <OptimizedProductImage
              src={article.coverImage}
              alt={article.title}
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

        <footer className="guide-article-footer">
          <strong>Quer montar pedido com orientacao?</strong>
          <p>Use o catalogo para combinar produtos e chame o atendimento para confirmar estoque, lote, validade e entrega.</p>
          <div className="hero-actions">
            <Link className="button primary" href="/categoria/all">
              Comprar pelo catalogo
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
