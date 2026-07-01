import type { Metadata } from "next";
import Link from "next/link";
import { StoreShell } from "@/components/StoreShell";
import { getActiveBrandSummaries, getCategories } from "@/lib/catalog";
import { storefrontMetadata } from "@/lib/seo";

export const metadata: Metadata = storefrontMetadata({
  title: "Marcas no atacado",
  description: "Escolha marcas de cosméticos para reposição, kits e compras no atacado com a RosaGiro.",
  path: "/marcas"
});

function brandHref(name: string) {
  return `/categoria/all?brand=${encodeURIComponent(name)}`;
}

export default async function BrandsPage() {
  const [categories, brands] = await Promise.all([getCategories(), getActiveBrandSummaries()]);

  return (
    <StoreShell categories={categories}>
      <section className="section brand-directory-hero">
        <div>
          <p className="eyebrow">Marcas</p>
          <h1>Compre por marca</h1>
          <p>
            Encontre rapidamente os produtos de cada marca para montar pedidos de reposição,
            kits e vitrines com mais facilidade.
          </p>
        </div>
      </section>

      <section className="section brand-directory-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Catálogo por marca</p>
            <h2>Marcas com produtos disponíveis</h2>
          </div>
          <p>Ao escolher uma marca, o catalogo abre filtrado apenas com os produtos relacionados.</p>
        </div>

        {brands.length ? (
          <div className="brand-directory-grid">
            {brands.map((brand) => (
              <Link className="brand-directory-card" href={brandHref(brand.name)} key={brand.slug}>
                <span className="brand-mark" aria-hidden="true">
                  {brand.logo}
                </span>
                <span>
                  <strong>{brand.name}</strong>
                  <small>
                    {brand.productCount} {brand.productCount === 1 ? "produto" : "produtos"}
                  </small>
                </span>
                {brand.descriptionPt.trim() ? <p>{brand.descriptionPt}</p> : null}
                <em>Ver produtos</em>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state brand-directory-empty">
            <h3>Nenhuma marca disponível</h3>
            <p>Assim que houver produtos ativos, as marcas aparecem aqui automaticamente.</p>
            <Link href="/categoria/all">Ver catálogo</Link>
          </div>
        )}
      </section>
    </StoreShell>
  );
}
