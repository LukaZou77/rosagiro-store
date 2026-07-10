import type { Metadata } from "next";
import Link from "next/link";
import { StoreShell } from "@/components/StoreShell";
import { getActiveBrandSummaries, getCategories } from "@/lib/catalog";
import { brandDisplayDescription, storefrontMetadata } from "@/lib/seo";

export const metadata: Metadata = storefrontMetadata({
  title: "Marcas de cosméticos no atacado",
  description: "Encontre marcas de cosméticos no atacado para revenda, reposição e pedidos multimarcas com a RosaGiro.",
  path: "/marcas"
});

export default async function BrandsPage() {
  const [categories, brands] = await Promise.all([getCategories(), getActiveBrandSummaries()]);

  return (
    <StoreShell categories={categories}>
      <section className="section brand-directory-hero">
        <div>
          <p className="eyebrow">Marcas</p>
          <h1>Marcas de cosméticos no atacado</h1>
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
          <p>Cada marca tem uma página própria com os produtos disponíveis, estoque sinalizado e acesso direto ao catálogo.</p>
        </div>

        {brands.length ? (
          <div className="brand-directory-grid">
            {brands.map((brand) => {
              const description = brandDisplayDescription(brand.descriptionPt);
              return (
                <Link className="brand-directory-card" href={`/marcas/${brand.slug}`} key={brand.slug}>
                  <span className="brand-mark" aria-hidden="true">
                    {brand.logo}
                  </span>
                  <span>
                    <strong>{brand.name}</strong>
                    <small>
                      {brand.productCount} {brand.productCount === 1 ? "produto" : "produtos"}
                    </small>
                  </span>
                  {description ? <p>{description}</p> : null}
                  <em>Ver produtos</em>
                </Link>
              );
            })}
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
