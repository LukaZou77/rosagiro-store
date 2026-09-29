import type { Metadata } from "next";
import { StoreShell } from "@/components/StoreShell";
import { getCategories } from "@/lib/catalog";
import { storefrontMetadata } from "@/lib/seo";
import { getSiteInfoPage } from "@/lib/site-info-pages";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getSiteInfoPage("privacy");
  return storefrontMetadata({
    title: page.title,
    description: page.description,
    path: page.href
  });
}

export default async function PrivacyPage() {
  const [page, categories] = await Promise.all([getSiteInfoPage("privacy"), getCategories()]);
  return (
    <StoreShell categories={categories}>
      <section className="info-hero">
        <p className="eyebrow">{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </section>
      <section className="info-sections" aria-label={page.title}>
        {page.sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
      <section className="section" aria-labelledby="site-statistics-title">
        <div style={{ maxWidth: 820 }}>
          <p className="eyebrow">Estatísticas do site</p>
          <h2 id="site-statistics-title">Estatísticas internas da RosaGiro</h2>
          <p>
            Utilizamos estatísticas internas para acompanhar visitas, visualizações de produtos, adições ao carrinho, cliques no WhatsApp e pedidos. Os eventos de navegação são enviados ao próprio site e podem utilizar identificadores locais do navegador. Sinais DNT e GPC mantêm a coleta desses eventos desativada.
          </p>
          <p>
            O site não carrega ferramentas de medição do Google Analytics ou Google Ads, mesmo que uma autorização tenha sido salva anteriormente neste navegador. Os registros necessários para processar e acompanhar seus pedidos continuam funcionando normalmente.
          </p>
        </div>
      </section>
    </StoreShell>
  );
}
