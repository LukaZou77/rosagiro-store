import Link from "next/link";
import { notFound } from "next/navigation";
import { updateProductDetailAction } from "@/app/admin/actions";
import { AdminProductForm } from "@/components/AdminProductForm";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { evaluateProductQuality, productQualityGroupLabels } from "@/lib/product-quality";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminProductDetailPage({ params, searchParams }: PageProps) {
  const [{ slug }, admin, query, brands, categories] = await Promise.all([
    params,
    requireAdmin(),
    searchParams,
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { label: "asc" } })
  ]);
  const product = await prisma.product.findUnique({
    where: { slug },
    include: { brand: true, category: true, inventory: true }
  });
  if (!product) notFound();

  const error = single(query.error);
  const saved = single(query.saved);
  const quality = evaluateProductQuality(product);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Ficha de produto</p>
        <h1>{product.name}</h1>
        <p>Edite a ficha completa que alimenta a vitrine, filtros, importação e checkout.</p>
        <div className="admin-actions">
          <Link className="button secondary" href="/admin/produtos">
            Voltar para produtos
          </Link>
          <Link className="button secondary" href={`/produto/${product.slug}`}>
            Ver na loja
          </Link>
        </div>
      </div>

      {saved ? (
        <div className="admin-notice success" role="status">
          Produto salvo com sucesso.
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}

      <section className={`import-panel quality-editor-panel ${quality.status.toLowerCase().replace("_", "-")}`}>
        <div className="readiness-group-heading">
          <div>
            <span>Qualidade da ficha</span>
            <h2>{quality.statusLabel}</h2>
          </div>
          <strong>{quality.issues.length}</strong>
        </div>
        <p className="table-note">{quality.statusMessage}</p>
        {quality.issues.length ? (
          <div className="quality-row-issues expanded">
            {quality.issues.map((issue) => (
              <span className={`quality-mini-issue ${issue.severity}`} key={issue.key}>
                {productQualityGroupLabels[issue.group]}: {issue.label}
              </span>
            ))}
          </div>
        ) : (
          <div className="admin-notice success">Nenhum alerta automático encontrado para este produto.</div>
        )}
        <div className="admin-actions">
          <Link className="button secondary" href="/admin/produtos/qualidade">
            Ver central de qualidade
          </Link>
        </div>
      </section>

      <AdminProductForm action={updateProductDetailAction} brands={brands} categories={categories} mode="edit" product={product} />
    </AdminShell>
  );
}
