"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type AdminTrashProductRow = {
  id: string;
  slug: string;
  name: string;
  image: string;
  brandName: string;
  categoryLabel: string;
  price: string;
  deletedAt: string;
  deletedBy: string;
  deleteNote: string;
};

type ProductTrashAction = (formData: FormData) => void | Promise<void>;

export function AdminProductTrashList({
  products,
  restoreAction,
  permanentDeleteAction
}: {
  products: AdminTrashProductRow[];
  restoreAction: ProductTrashAction;
  permanentDeleteAction: ProductTrashAction;
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

  function confirmAction(event: React.FormEvent<HTMLFormElement>) {
    if (!selectedIds.length) {
      event.preventDefault();
      window.alert("Selecione pelo menos um produto da lixeira.");
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent = submitter?.dataset.intent;
    const message =
      intent === "permanent"
        ? `Excluir definitivamente ${selectedIds.length} produto(s)? Esta ação não pode ser desfeita.`
        : `Restaurar e publicar ${selectedIds.length} produto(s)?`;

    if (!window.confirm(message)) event.preventDefault();
  }

  return (
    <form className="admin-bulk-form" onSubmit={confirmAction}>
      {selectedIds.map((id) => (
        <input type="hidden" name="productIds" value={id} key={id} />
      ))}
      <div className="admin-bulk-toolbar">
        <label className="checkbox-line">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          Selecionar todos
        </label>
        <span>{selectedIds.length} selecionado(s)</span>
        <button className="button primary" type="submit" formAction={restoreAction} data-intent="restore">
          Restaurar e publicar
        </button>
        <button className="button secondary danger" type="submit" formAction={permanentDeleteAction} data-intent="permanent">
          Excluir definitivamente
        </button>
      </div>

      <div className="admin-list">
        {products.map((product) => (
          <article className="admin-product-row catalog-row selectable-row trashed-row" key={product.id}>
            <label className="row-select" aria-label={`Selecionar ${product.name}`}>
              <input type="checkbox" checked={selectedSet.has(product.id)} onChange={() => toggleProduct(product.id)} />
            </label>
            <img src={product.image} alt={product.name} />
            <div className="admin-product-summary">
              <div>
                <span className="status-chip warning">Na lixeira</span>
                <span className="status-chip">{product.slug}</span>
              </div>
              <h2>{product.name}</h2>
              <p>
                {product.brandName} / {product.categoryLabel}
              </p>
              <div className="admin-row-meta">
                <strong>{product.price}</strong>
                <small>Removido em {product.deletedAt}</small>
                <small>{product.deletedBy}</small>
              </div>
              {product.deleteNote ? <p className="table-note">{product.deleteNote}</p> : null}
            </div>
            <div className="admin-row-actions">
              <Link className="button secondary" href={`/admin/produtos/${product.slug}`} prefetch={false}>
                Ver ficha
              </Link>
            </div>
          </article>
        ))}
      </div>
    </form>
  );
}
