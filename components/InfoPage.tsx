import { StoreShell } from "@/components/StoreShell";
import { getCategories } from "@/lib/catalog";
import type { InfoPageContent } from "@/lib/site-config";

export async function InfoPage({ page }: { page: InfoPageContent }) {
  const categories = await getCategories();

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
    </StoreShell>
  );
}
