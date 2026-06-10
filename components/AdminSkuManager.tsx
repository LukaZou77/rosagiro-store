"use client";

import { useState } from "react";

type AdminSkuRow = {
  id?: string;
  name: string;
  code: string;
  quantity: number;
  active: boolean;
  sortOrder: number;
};

type EditableSkuRow = AdminSkuRow & {
  key: string;
  deleted?: boolean;
};

export function AdminSkuManager({ skus }: { skus: AdminSkuRow[] }) {
  const [rows, setRows] = useState<EditableSkuRow[]>(
    skus.map((sku) => ({ ...sku, key: sku.id || `sku-${sku.sortOrder}` }))
  );
  const visibleRows = rows.filter((row) => !row.deleted);

  function updateRow(key: string, patch: Partial<EditableSkuRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    setRows((current) =>
      current.flatMap((row) => {
        if (row.key !== key) return [row];
        return row.id ? [{ ...row, deleted: true }] : [];
      })
    );
  }

  function addRow() {
    const sortOrder = rows.length ? Math.max(...rows.map((row) => row.sortOrder)) + 10 : 10;
    setRows((current) => [
      ...current,
      {
        key: `new-${Date.now()}-${current.length}`,
        name: "",
        code: "",
        quantity: 0,
        active: true,
        sortOrder
      }
    ]);
  }

  return (
    <div className="admin-form-block sku-manager">
      <div className="product-gallery-heading">
        <div>
          <strong>SKU / variações</strong>
          <small>Use para cor, tom, modelo ou tamanho. O estoque do produto será a soma das variações ativas.</small>
        </div>
        <span>{visibleRows.length}</span>
      </div>

      {rows
        .filter((row) => row.deleted && row.id)
        .map((row) => (
          <input key={`delete-${row.id}`} name="skuDeleteId" type="hidden" value={row.id} />
        ))}

      <div className="sku-admin-list">
        {visibleRows.length ? (
          visibleRows.map((row, index) => (
            <div className="sku-admin-row" key={row.key}>
              <input name="skuRowKey" type="hidden" value={row.key} />
              <input name={`skuId:${row.key}`} type="hidden" value={row.id || ""} />
              <label>
                Nome da variação
                <input
                  name={`skuName:${row.key}`}
                  onChange={(event) => updateRow(row.key, { name: event.target.value })}
                  placeholder="Ex: Cor 01, Rosa, 250 ml"
                  value={row.name}
                />
              </label>
              <label>
                Código SKU
                <input
                  name={`skuCode:${row.key}`}
                  onChange={(event) => updateRow(row.key, { code: event.target.value })}
                  placeholder="Ex: RG-BASE-01"
                  value={row.code}
                />
              </label>
              <label>
                Estoque
                <input
                  min="0"
                  name={`skuQuantity:${row.key}`}
                  onChange={(event) => updateRow(row.key, { quantity: Math.max(0, Math.floor(Number(event.target.value) || 0)) })}
                  type="number"
                  value={row.quantity}
                />
              </label>
              <label>
                Ordem
                <input
                  min="0"
                  name={`skuSortOrder:${row.key}`}
                  onChange={(event) => updateRow(row.key, { sortOrder: Math.max(0, Math.floor(Number(event.target.value) || index * 10)) })}
                  type="number"
                  value={row.sortOrder}
                />
              </label>
              <label className="checkbox-label compact">
                <input
                  checked={row.active}
                  name={`skuActive:${row.key}`}
                  onChange={(event) => updateRow(row.key, { active: event.target.checked })}
                  type="checkbox"
                  value="on"
                />
                Ativa
              </label>
              <button className="button secondary" onClick={() => removeRow(row.key)} type="button">
                Remover
              </button>
            </div>
          ))
        ) : (
          <div className="empty-state compact">
            <strong>Sem variações cadastradas</strong>
            <p>Produtos sem SKU continuam usando o estoque geral. Adicione variações quando houver cor, tom ou modelo.</p>
          </div>
        )}
      </div>

      <button className="button secondary" onClick={addRow} type="button">
        Adicionar SKU
      </button>
      <p className="table-note">
        Se houver SKU ativo, o cliente escolherá as variações na página do produto. Preço, peso e imagens continuam iguais ao produto principal.
      </p>
    </div>
  );
}
