import type { Metadata } from "next";
import Link from "next/link";
import { StoreShell } from "@/components/StoreShell";
import { StoreTrustSignals } from "@/components/StoreTrustSignals";
import { StructuredData } from "@/components/StructuredData";
import { getCategories } from "@/lib/catalog";
import { breadcrumbJsonLd, storefrontMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";
import {
  getStoreProfile,
  publicLegalName,
  storeCnpjLabel,
  publicStoreProfileNotes,
  storeProfileAddress,
  storeSocialLinks,
  storeTrustSignals
} from "@/lib/store-profile";

export const metadata: Metadata = storefrontMetadata({
  title: "Informações da loja",
  description: "Dados comerciais, atendimento, entrega, pagamento e políticas da RosaGiro.",
  path: "/informacoes-da-loja"
});

export default async function StoreInformationPage() {
  const [categories, profile] = await Promise.all([getCategories(), getStoreProfile()]);
  const socialLinks = storeSocialLinks(profile);
  const trustSignals = storeTrustSignals(profile, 5);
  const publicNotes = publicStoreProfileNotes(profile);
  const legalName = publicLegalName(profile);

  return (
    <StoreShell categories={categories}>
      <StructuredData
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Informações da loja", path: "/informacoes-da-loja" }
        ])}
      />
      <section className="info-hero store-info-hero">
        <div>
          <p className="eyebrow">Loja / Confiança</p>
          <h1>Informações da loja RosaGiro</h1>
          <p>Dados comerciais, atendimento e orientações operacionais para comprar com mais clareza.</p>
        </div>
        <StoreTrustSignals signals={trustSignals} showLink={false} />
      </section>

      <section className="store-info-layout">
        <article className="store-info-card">
          <span>Identificação</span>
          <h2>{profile.storeName}</h2>
          <dl>
            {legalName ? (
              <div>
                <dt>Razão social</dt>
                <dd>{legalName}</dd>
              </div>
            ) : null}
            <div>
              <dt>CNPJ</dt>
              <dd>{storeCnpjLabel(profile)}</dd>
            </div>
            <div>
              <dt>Inscrição estadual</dt>
              <dd>{publicNotes.stateRegistration}</dd>
            </div>
          </dl>
        </article>

        <article className="store-info-card">
          <span>Atendimento</span>
          <h2>Canais oficiais</h2>
          <dl>
            <div>
              <dt>WhatsApp</dt>
              <dd>{profile.whatsapp}</dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>{profile.email}</dd>
            </div>
            <div>
              <dt>Horário</dt>
              <dd>{profile.businessHours}</dd>
            </div>
          </dl>
          {socialLinks.length ? (
            <div className="store-social-row">
              {socialLinks.map((link) => (
                <a href={link.href} key={link.label} rel="noreferrer" target="_blank">
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}
        </article>

        <article className="store-info-card wide">
          <span>{siteConfig.businessIdentity.operatingAddressLabel}</span>
          <h2>Estoque e retirada em Arujá</h2>
          <p>{storeProfileAddress(profile)}</p>
          <p>{profile.pickupNote}</p>
        </article>

        <article className="store-info-card wide">
          <span>{siteConfig.businessIdentity.saoPauloLocationLabel}</span>
          <h2>Estoque e retirada em São Paulo</h2>
          <p>
            {siteConfig.businessIdentity.legalAddress.streetAddress}, {siteConfig.businessIdentity.legalAddress.district},{" "}
            {siteConfig.businessIdentity.legalAddress.city} - {siteConfig.businessIdentity.legalAddress.state}, CEP{" "}
            {siteConfig.businessIdentity.legalAddress.postalCode}.
          </p>
          <p>{siteConfig.businessIdentity.pickupNote}</p>
        </article>

        <article className="store-info-card">
          <span>Entrega</span>
          <h2>Transporte e excursão</h2>
          <strong>{siteConfig.wholesale.nationalDeliveryText}</strong>
          <p>{profile.shippingNote}</p>
          <p>{siteConfig.wholesale.nationalDeliveryNote}</p>
          <Link href="/entrega">Ver política de entrega</Link>
        </article>

        <article className="store-info-card">
          <span>Pagamento</span>
          <h2>Formas de pagamento</h2>
          <p>{publicNotes.paymentNote}</p>
          <Link href="/termos-de-uso">Ver termos de uso</Link>
        </article>

        <article className="store-info-card">
          <span>Pós-compra</span>
          <h2>Trocas e devoluções</h2>
          <p>{profile.exchangeNote}</p>
          <Link href="/trocas-e-devolucoes">Ver política de trocas</Link>
        </article>

        <article className="store-info-card launch-note">
          <span>Status</span>
          <h2>Antes de comprar</h2>
          <p>{publicNotes.launchNote}</p>
        </article>
      </section>
    </StoreShell>
  );
}
