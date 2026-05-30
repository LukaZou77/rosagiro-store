import Link from "next/link";
import { CartCount } from "@/components/CartCount";
import { legalLinks, siteConfig, storefrontLinks } from "@/lib/site-config";

type CategoryLink = {
  slug: string;
  label: string;
};

export function StoreShell({
  categories,
  children
}: {
  categories: CategoryLink[];
  children: React.ReactNode;
}) {
  return (
    <>
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
          {storefrontLinks.slice(1, 3).map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
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
        </div>
        <nav aria-label="Links de suporte">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
          <Link href="/contato">Contato</Link>
        </nav>
      </footer>
      <nav className="mobile-tabs" aria-label="Navegacao principal">
        <Link href="/">Inicio</Link>
        <Link href="/categoria/all">Categorias</Link>
        <Link href="/carrinho">Carrinho</Link>
      </nav>
    </>
  );
}
