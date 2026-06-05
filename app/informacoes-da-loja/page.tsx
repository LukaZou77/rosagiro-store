import type { Metadata } from "next";
import Link from "next/link";
import { StoreShell } from "@/components/StoreShell";
import { StoreTrustSignals } from "@/components/StoreTrustSignals";
import { getCategories } from "@/lib/catalog";
import { storefrontMetadata } from "@/lib/seo";
import {
  getStoreProfile,
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

  return (
    <StoreShell categories={categories}>
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
            <div>
              <dt>Razão social</dt>
              <dd>{profile.legalName}</dd>
            </div>
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
          <span>Endereço</span>
          <h2>Retirada e conferência</h2>
          <p>{storeProfileAddress(profile)}</p>
          <p>{profile.pickupNote}</p>
        </article>

        <article className="store-info-card">
          <span>Entrega</span>
          <h2>Transporte e excursão</h2>
          <p>{profile.shippingNote}</p>
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
