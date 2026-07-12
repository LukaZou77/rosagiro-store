"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAdminLanguage } from "@/components/AdminLanguageProvider";

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
  const { t } = useAdminLanguage();
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
      window.alert(t("Selecione pelo menos um produto da lixeira.", "请至少选择一个回收站商品。"));
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent = submitter?.dataset.intent;
    const message =
      intent === "permanent"
        ? t(`Excluir definitivamente ${selectedIds.length} produto(s)? Esta ação não pode ser desfeita.`, `永久删除 ${selectedIds.length} 个商品？此操作无法撤销。`)
        : t(`Restaurar e publicar ${selectedIds.length} produto(s)?`, `恢复并上架 ${selectedIds.length} 个商品？`);

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
          {t("Selecionar todos", "全选")}
        </label>
        <span>{selectedIds.length} {t("selecionado(s)", "项已选择")}</span>
        <button className="button primary" type="submit" formAction={restoreAction} data-intent="restore">
          {t("Restaurar e publicar", "恢复并上架")}
        </button>
        <button className="button secondary danger" type="submit" formAction={permanentDeleteAction} data-intent="permanent">
          {t("Excluir definitivamente", "永久删除")}
        </button>
      </div>

      <div className="admin-list">
        {products.map((product) => (
          <article className="admin-product-row catalog-row selectable-row trashed-row" key={product.id}>
            <label className="row-select" aria-label={t(`Selecionar ${product.name}`, `选择 ${product.name}`)}>
              <input type="checkbox" checked={selectedSet.has(product.id)} onChange={() => toggleProduct(product.id)} />
            </label>
            <img src={product.image} alt={product.name} />
            <div className="admin-product-summary">
              <div>
                <span className="status-chip warning">{t("Na lixeira", "在回收站")}</span>
                <span className="status-chip">{product.slug}</span>
              </div>
              <h2>{product.name}</h2>
              <p>
                {product.brandName} / {product.categoryLabel}
              </p>
              <div className="admin-row-meta">
                <strong>{product.price}</strong>
                <small>{t("Removido em", "移除时间")} {product.deletedAt}</small>
                <small>{product.deletedBy}</small>
              </div>
              {product.deleteNote ? <p className="table-note">{product.deleteNote}</p> : null}
            </div>
            <div className="admin-row-actions">
              <Link className="button secondary" href={`/admin/produtos/${product.slug}`} prefetch={false}>
                {t("Ver ficha", "查看资料")}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </form>
  );
}
