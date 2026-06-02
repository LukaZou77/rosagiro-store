import Link from "next/link";
import { CartCount } from "@/components/CartCount";
import { CustomerSessionProvider } from "@/components/CustomerSession";
import { QuickPurchaseDrawer } from "@/components/QuickPurchaseDrawer";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { legalLinks, siteConfig, storefrontLinks } from "@/lib/site-config";
import { getStoreProfile, storeCnpjLabel, storeSocialLinks, storeTrustSignals } from "@/lib/store-profile";
import { buildGeneralWhatsAppHref } from "@/lib/whatsapp";

type CategoryLink = {
  slug: string;
  label: string;
};

export async function StoreShell({
  categories,
  children
}: {
  categories: CategoryLink[];
  children: React.ReactNode;
}) {
  const generalWhatsAppHref = buildGeneralWhatsAppHref("navegacao principal");
  const storeProfile = await getStoreProfile();
  const trustSignals = storeTrustSignals(storeProfile, 3);
  const socialLinks = storeSocialLinks(storeProfile);

  return (
    <CustomerSessionProvider>
      <div className="store-alert" aria-label="Condicoes de compra">
        <span>{siteConfig.wholesale.headerStrip}</span>
        <Link href="/informacoes-da-loja">{storeCnpjLabel(storeProfile)}</Link>
        <WhatsAppLink href={generalWhatsAppHref}>{siteConfig.whatsapp.serviceLabel}</WhatsAppLink>
      </div>
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">BV</span>
          <span>
            <strong>Bela Viva</strong>
            <small>beleza multimarcas</small>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Categorias">
          {categories.slice(0, 5).map((category) => (
            <Link key={category.slug} href={`/categoria/${category.slug}`}>
              {category.label}
            </Link>
          ))}
          {storefrontLinks.slice(1, 4).map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
          <WhatsAppLink href={generalWhatsAppHref}>{siteConfig.whatsapp.label}</WhatsAppLink>
        </nav>
        <CartCount />
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <div>
          <Link className="brand" href="/">
            <span className="brand-mark">BV</span>
            <span>
              <strong>{siteConfig.name}</strong>
              <small>{siteConfig.tagline}</small>
            </span>
          </Link>
          <p>{siteConfig.description}</p>
          <p className="store-trust">{siteConfig.wholesale.storeTrust}</p>
        </div>
        <nav aria-label="Links de suporte">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
          <Link href="/contato">Contato</Link>
          <Link href="/informacoes-da-loja">Informacoes da loja</Link>
        </nav>
        <div className="footer-trust-list" aria-label="Sinais de confianca">
          {trustSignals.map((signal) => (
            <span key={signal}>{signal}</span>
          ))}
        </div>
        {socialLinks.length ? (
          <nav aria-label="Redes sociais">
            {socialLinks.map((link) => (
              <a href={link.href} key={link.label} rel="noreferrer" target="_blank">
                {link.label}
              </a>
            ))}
          </nav>
        ) : null}
      </footer>
      <QuickPurchaseDrawer />
      <nav className="mobile-tabs" aria-label="Navegacao principal">
        <Link href="/">Inicio</Link>
        <Link href="/promocoes">Ofertas</Link>
        <Link href="/categoria/all">Categorias</Link>
        <Link href="/carrinho">Carrinho</Link>
        <WhatsAppLink href={generalWhatsAppHref}>{siteConfig.whatsapp.label}</WhatsAppLink>
      </nav>
    </CustomerSessionProvider>
  );
}
