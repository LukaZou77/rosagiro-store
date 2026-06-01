import Link from "next/link";
import { notFound } from "next/navigation";
import { updateProductDetailAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatImportMoney, pipeListValue } from "@/lib/product-import-shared";

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

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Ficha de produto</p>
        <h1>{product.name}</h1>
        <p>Edite a ficha completa que alimenta a vitrine, filtros, importacao e checkout.</p>
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

      <form action={updateProductDetailAction} className="admin-detail-grid product-editor">
        <input type="hidden" name="productId" value={product.id} />
        <section className="import-panel">
          <img className="product-editor-image" src={product.image} alt={product.name} />
          <div className="form-grid">
            <label>
              Slug
              <input value={product.slug} readOnly />
            </label>
            <label>
              Rank de vitrine
              <input name="featuredRank" type="number" min="0" defaultValue={product.featuredRank} />
            </label>
          </div>
          <label>
            Caminho ou URL da imagem
            <input name="image" defaultValue={product.image} required />
          </label>
          <p className="table-note">Aceita /assets/..., /placeholder... ou URL http(s). Upload fica para uma fase futura.</p>
        </section>

        <section className="import-panel">
          <div className="form-grid">
            <label>
              Nome
              <input name="name" defaultValue={product.name} required />
            </label>
            <label>
              Marca
              <select name="brandId" defaultValue={product.brandId} required>
                {brands.map((brand) => (
                  <option value={brand.id} key={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Categoria
              <select name="categoryId" defaultValue={product.categoryId} required>
                {categories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subcategoria
              <input name="subcategory" defaultValue={product.subcategory} required />
            </label>
          </div>

          <label>
            Descricao
            <textarea name="descriptionPt" defaultValue={product.descriptionPt} required />
          </label>

          <div className="form-grid">
            <label>
              Preco
              <input name="price" defaultValue={formatImportMoney(product.priceCents)} required />
            </label>
            <label>
              Preco comparativo
              <input name="compareAtPrice" defaultValue={formatImportMoney(product.compareAtPriceCents)} />
            </label>
            <label>
              Estoque
              <input name="quantity" type="number" min="0" defaultValue={product.inventory?.quantity || 0} />
            </label>
            <label className="checkbox-label">
              <input name="active" type="checkbox" defaultChecked={product.active} />
              Produto ativo
            </label>
          </div>

          <div className="form-grid">
            <label>
              Beneficios
              <textarea name="benefits" defaultValue={pipeListValue(product.benefits)} />
            </label>
            <label>
              Ingredientes
              <textarea name="ingredients" defaultValue={pipeListValue(product.ingredients)} />
            </label>
            <label>
              Tags / badges
              <textarea name="badges" defaultValue={pipeListValue(product.badges)} />
            </label>
          </div>
          <p className="table-note">Use | para separar varios itens, igual ao CSV.</p>

          <div className="form-grid">
            <label>
              Tipo de pele / uso
              <input name="skinType" defaultValue={product.skinType} />
            </label>
            <label>
              Acabamento / textura
              <input name="finish" defaultValue={product.finish} />
            </label>
            <label>
              Volume / tamanho
              <input name="volume" defaultValue={product.volume} />
            </label>
            <label>
              Rating
              <input name="rating" defaultValue={String(product.rating).replace(".", ",")} />
            </label>
            <label>
              Avaliacoes
              <input name="reviewCount" type="number" min="0" defaultValue={product.reviewCount} />
            </label>
          </div>

          <button className="button primary wide" type="submit">
            Salvar ficha completa
          </button>
        </section>
      </form>
    </AdminShell>
  );
}
