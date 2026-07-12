"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAdminLanguage } from "@/components/AdminLanguageProvider";

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

  function confirmTrash(event: React.FormEvent<HTMLFormElement>) {
    if (!selectedIds.length) {
      event.preventDefault();
      window.alert(t("Selecione pelo menos um produto para mover para a lixeira.", "请至少选择一个要移入回收站的商品。"));
      return;
    }

    if (!window.confirm(t(`Mover ${selectedIds.length} produto(s) para a lixeira? Eles sairão da loja, mas poderão ser restaurados.`, `将 ${selectedIds.length} 个商品移入回收站？商品将从前台下架，但之后可以恢复。`))) {
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
          {t("Selecionar todos", "全选")}
        </label>
        <span>{selectedIds.length} {t("selecionado(s)", "项已选择")}</span>
        <input name="deleteNote" placeholder={t("Observação opcional para a lixeira", "回收站备注（选填）")} />
        <button className="button secondary danger" type="submit">
          {t("Mover para lixeira", "移入回收站")}
        </button>
      </div>

      <div className="admin-list">
        {products.map((product) => (
          <article className="admin-product-row catalog-row selectable-row" key={product.id}>
            <label className="row-select" aria-label={t(`Selecionar ${product.name}`, `选择 ${product.name}`)}>
              <input type="checkbox" checked={selectedSet.has(product.id)} onChange={() => toggleProduct(product.id)} />
            </label>
            <img src={product.image} alt={product.name} />
            <div className="admin-product-summary">
              <div>
                <span className="status-chip">{product.slug}</span>
                <span className={product.active ? "status-chip success" : "status-chip warning"}>
                  {product.active ? t("Ativo", "启用") : t("Inativo", "停用")}
                </span>
                <span className={product.inStock ? "status-chip success" : "status-chip warning"}>
                  {product.inStock ? t("Em estoque", "有货") : t("Sem estoque", "缺货")}
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
                <small>{t("Rank", "排序")} {product.featuredRank}</small>
                {product.weightGrams ? <small>{product.weightGrams} g</small> : null}
              </div>
            </div>
            <div className="admin-row-actions">
              <Link className="button secondary" href={`/produto/${product.slug}`} prefetch={false}>
                {t("Ver loja", "查看前台")}
              </Link>
              <Link className="button primary" href={`/admin/produtos/${product.slug}`} prefetch={false}>
                {t("Editar ficha", "编辑资料")}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </form>
  );
}
