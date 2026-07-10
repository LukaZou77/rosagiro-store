import type { Metadata } from "next";
import Link from "next/link";
import { StoreShell } from "@/components/StoreShell";
import { getCategories } from "@/lib/catalog";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = noIndexMetadata(
  "Página não encontrada",
  "A página que você tentou acessar não foi encontrada na RosaGiro."
);

export default async function NotFoundPage() {
  const categories = await getCategories();

  return (
    <StoreShell categories={categories}>
      <section className="section">
        <div className="empty-state">
          <p className="eyebrow">Erro 404</p>
          <h1>Página não encontrada</h1>
          <p>O endereço pode ter mudado ou o conteúdo não está mais disponível.</p>
          <div className="hero-actions">
            <Link className="button primary" href="/categoria/all">
              Ver catálogo
            </Link>
            <Link className="button secondary" href="/">
              Voltar ao início
            </Link>
          </div>
        </div>
      </section>
    </StoreShell>
  );
}
