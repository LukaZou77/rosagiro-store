import type { Metadata } from "next";
import { AnalyticsConsentSettingsButton } from "@/components/AnalyticsConsent";
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
      <section className="section" aria-labelledby="google-measurement-title">
        <div style={{ maxWidth: 820 }}>
          <p className="eyebrow">Preferências opcionais</p>
          <h2 id="google-measurement-title">Google Analytics e Google Ads</h2>
          <p>
            Essas ferramentas são opcionais e só carregam depois da sua autorização. Quando permitidas, podem usar cookies e identificadores para medir, de forma pseudônima, o tráfego, as interações e as compras no site.
          </p>
          <p>
            A integração não envia CPF, e-mail, telefone, conteúdo de mensagens ou conversas no WhatsApp ao Google. Sinais DNT e GPC do navegador mantêm essa medição desativada e não podem ser substituídos por uma escolha no site.
          </p>
          <p>
            Você pode alterar ou retirar sua autorização neste navegador a qualquer momento. Consulte também a <a href="https://policies.google.com/privacy" rel="noreferrer" target="_blank">Política de Privacidade do Google</a>.
          </p>
          <AnalyticsConsentSettingsButton />
        </div>
      </section>
    </StoreShell>
  );
}
