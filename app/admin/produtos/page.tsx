import { updateProductAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";

function brlValue(cents: number | null) {
  if (!cents) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export default async function AdminProductsPage() {
  const admin = await requireAdmin();
  const products = await prisma.product.findMany({
    include: { brand: true, category: true, inventory: true },
    orderBy: { featuredRank: "asc" }
  });

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Produtos</p>
        <h1>Catalogo e estoque</h1>
        <Link className="button secondary" href="/admin/importar-produtos">
          Importar CSV
        </Link>
      </div>
      <div className="admin-list">
        {products.map((product) => (
          <form action={updateProductAction} className="admin-product-row" key={product.id}>
            <input type="hidden" name="productId" value={product.id} />
            <img src={product.image} alt={product.name} />
            <div className="admin-product-fields">
              <label>
                Nome
                <input name="name" defaultValue={product.name} required />
              </label>
              <div className="form-grid">
                <label>
                  Categoria
                  <input value={`${product.category.label} / ${product.brand.name}`} readOnly />
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
                  <input name="price" defaultValue={brlValue(product.priceCents)} required />
                </label>
                <label>
                  Preco comparativo
                  <input name="compareAtPrice" defaultValue={brlValue(product.compareAtPriceCents)} />
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
              <button className="button primary" type="submit">
                Salvar produto
              </button>
            </div>
          </form>
        ))}
      </div>
    </AdminShell>
  );
}
