import type { Metadata } from "next";
import Link from "next/link";
import { StoreShell } from "@/components/StoreShell";
import { StructuredData } from "@/components/StructuredData";
import { getCategories } from "@/lib/catalog";
import { breadcrumbJsonLd, storefrontMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";
import { getStoreProfile, storeProfileAddress } from "@/lib/store-profile";

export const metadata: Metadata = storefrontMetadata({
  title: "Quem somos",
  description: "Conheça a RosaGiro, a operação responsável pela loja, nosso atendimento e o processo de compra de cosméticos no atacado.",
  path: "/quem-somos"
});

export default async function AboutPage() {
  const [categories, profile] = await Promise.all([getCategories(), getStoreProfile()]);

  return (
    <StoreShell categories={categories}>
      <StructuredData
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Quem somos", path: "/quem-somos" }
        ])}
      />
      <section className="info-hero">
        <div>
          <p className="eyebrow">RosaGiro</p>
          <h1>Atacado de cosméticos com atendimento próximo</h1>
          <p>
            A RosaGiro atende lojistas, revendedores e profissionais que precisam montar pedidos multimarcas com
            informações claras de preço, estoque, embalagem e entrega.
          </p>
        </div>
      </section>

      <section className="section about-principles" aria-label="Como a RosaGiro trabalha">
        <article>
          <span className="eyebrow">Quem opera</span>
          <h2>{siteConfig.businessIdentity.legalName}</h2>
          <p>{siteConfig.businessIdentity.relationship} CNPJ {siteConfig.businessIdentity.taxId}.</p>
        </article>
        <article>
          <span className="eyebrow">Como selecionamos</span>
          <h2>Catálogo para revenda</h2>
          <p>Organizamos marcas e categorias de beleza com preço unitário, embalagem de atacado e estoque sinalizado.</p>
        </article>
        <article>
          <span className="eyebrow">Como atendemos</span>
          <h2>Compra acompanhada</h2>
          <p>O site ajuda a montar o pedido e o WhatsApp apoia dúvidas sobre lote, validade, volume, retirada e entrega.</p>
        </article>
      </section>

      <section className="section split-band">
        <div>
          <p className="eyebrow">Operação</p>
          <h2>Endereço operacional e retirada</h2>
          <p>{storeProfileAddress(profile)}</p>
          <p>{profile.pickupNote}</p>
        </div>
        <div>
          <p className="eyebrow">Compromisso</p>
          <h2>Informação antes da compra</h2>
          <p>
            Mantemos dados comerciais, políticas, canais oficiais e condições de atacado visíveis. Informações de
            produto são revisadas com base em embalagem, fornecedor ou fontes de mercado antes da publicação.
          </p>
          <Link className="button secondary" href="/informacoes-da-loja">Ver dados da loja</Link>
        </div>
      </section>
    </StoreShell>
  );
}
