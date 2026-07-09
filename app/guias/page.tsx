import type { Metadata } from "next";
import Link from "next/link";
import { OptimizedProductImage } from "@/components/OptimizedProductImage";
import { StoreShell } from "@/components/StoreShell";
import { getCategories } from "@/lib/catalog";
import { getPublishedGuideArticles } from "@/lib/guide-articles";
import { storefrontMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const articles = await getPublishedGuideArticles({ take: 1 });
  const metadata = storefrontMetadata({
    title: "Guias de compra para revenda",
    description: "Guias da RosaGiro para comprar cosméticos no atacado, montar pedidos de revenda e escolher categorias com mais segurança.",
    path: "/guias"
  });

  if (articles.length) return metadata;
  return {
    ...metadata,
    robots: {
      index: false,
      follow: true
    }
  };
}

export default async function GuidesPage() {
  const [categories, articles] = await Promise.all([getCategories(), getPublishedGuideArticles()]);

  return (
    <StoreShell categories={categories}>
      <section className="info-hero guide-hero">
        <p className="eyebrow">Guias RosaGiro</p>
        <h1>Conteúdo rápido para comprar melhor no atacado.</h1>
        <p>
          Artigos sobre categorias, reposição, pedido mínimo, entrega e cuidados para quem compra cosméticos para revenda.
        </p>
      </section>

      <section className="guide-list-section" aria-label="Guias publicados">
        {articles.length ? (
          <div className="guide-card-grid">
            {articles.map((article) => (
              <Link className="guide-card" href={`/guias/${article.slug}`} key={article.slug}>
                <span className="guide-card-media">
                  {article.coverImage ? (
                    <OptimizedProductImage
                      src={article.coverImage}
                      alt={article.title}
                      fill
                      sizes="(min-width: 960px) 30vw, 90vw"
                    />
                  ) : (
                    <span className="guide-card-placeholder">RG</span>
                  )}
                </span>
                <span className="eyebrow">Guia de compra</span>
                <strong>{article.title}</strong>
                <small>{article.excerpt}</small>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>Guias em preparação</h2>
            <p>Em breve a RosaGiro vai publicar orientações de compra, revenda e categorias de cosméticos.</p>
            <Link className="button primary" href="/categoria/all">
              Ver catálogo
            </Link>
          </div>
        )}
      </section>
    </StoreShell>
  );
}
