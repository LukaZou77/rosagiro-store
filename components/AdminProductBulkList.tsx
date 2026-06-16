"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type AdminProductListRow = {
  id: string;
  slug: string;
  name: string;
  image: string;
  active: boolean;
  inStock: boolean;
  brandName: string;
  categoryLabel: string;
  subcategory: string;
  price: string;
  featuredRank: number;
  weightGrams: number | null;
  qualityStatusLabel: string | null;
  qualityStatusClass: string | null;
};

type ProductTrashAction = (formData: FormData) => void | Promise<void>;

export function AdminProductBulkList({
  products,
  action
}: {
  products: AdminProductListRow[];
  action: ProductTrashAction;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = products.length > 0 && selectedIds.length === products.length;

  function toggleProduct(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : products.map((product) => product.id));
  }

  function confirmTrash(event: React.FormEvent<HTMLFormElement>) {
    if (!selectedIds.length) {
      event.preventDefault();
      window.alert("Selecione pelo menos um produto para mover para a lixeira.");
      return;
    }

    if (!window.confirm(`Mover ${selectedIds.length} produto(s) para a lixeira? Eles sairão da loja, mas poderão ser restaurados.`)) {
      event.preventDefault();
    }
  }

  return (
    <form className="admin-bulk-form" action={action} onSubmit={confirmTrash}>
      {selectedIds.map((id) => (
        <input type="hidden" name="productIds" value={id} key={id} />
      ))}
      <div className="admin-bulk-toolbar">
        <label className="checkbox-line">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          Selecionar todos
        </label>
        <span>{selectedIds.length} selecionado(s)</span>
        <input name="deleteNote" placeholder="Observação opcional para a lixeira" />
        <button className="button secondary danger" type="submit">
          Mover para lixeira
        </button>
      </div>

      <div className="admin-list">
        {products.map((product) => (
          <article className="admin-product-row catalog-row selectable-row" key={product.id}>
            <label className="row-select" aria-label={`Selecionar ${product.name}`}>
              <input type="checkbox" checked={selectedSet.has(product.id)} onChange={() => toggleProduct(product.id)} />
            </label>
            <img src={product.image} alt={product.name} />
            <div className="admin-product-summary">
              <div>
                <span className="status-chip">{product.slug}</span>
                <span className={product.active ? "status-chip success" : "status-chip warning"}>
                  {product.active ? "Ativo" : "Inativo"}
                </span>
                <span className={product.inStock ? "status-chip success" : "status-chip warning"}>
                  {product.inStock ? "Em estoque" : "Sem estoque"}
                </span>
                {product.qualityStatusLabel && product.qualityStatusClass ? (
                  <span className={`status-chip ${product.qualityStatusClass}`}>{product.qualityStatusLabel}</span>
                ) : null}
              </div>
              <h2>{product.name}</h2>
              <p>
                {product.brandName} / {product.categoryLabel} / {product.subcategory}
              </p>
              <div className="admin-row-meta">
                <strong>{product.price}</strong>
                <small>Rank {product.featuredRank}</small>
                {product.weightGrams ? <small>{product.weightGrams} g</small> : null}
              </div>
            </div>
            <div className="admin-row-actions">
              <Link className="button secondary" href={`/produto/${product.slug}`}>
                Ver loja
              </Link>
              <Link className="button primary" href={`/admin/produtos/${product.slug}`}>
                Editar ficha
              </Link>
            </div>
          </article>
        ))}
      </div>
    </form>
  );
}
