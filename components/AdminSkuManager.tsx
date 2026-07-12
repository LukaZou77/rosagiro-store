"use client";

import { useState } from "react";
import { INTERNAL_AVAILABLE_STOCK_QUANTITY, stockAvailabilityValue } from "@/lib/product-stock";
import { formatImportMoney, parseCents } from "@/lib/product-import-shared";
import { useAdminLanguage } from "@/components/AdminLanguageProvider";

type AdminSkuRow = {
  id?: string;
  name: string;
  code: string;
  image?: string | null;
  priceCents?: number | null;
  basePriceCents?: number | null;
  quantity: number;
  active: boolean;
  sortOrder: number;
};

type EditableSkuRow = AdminSkuRow & {
  key: string;
  deleted?: boolean;
};

export function AdminSkuManager({ skus }: { skus: AdminSkuRow[] }) {
  const { t } = useAdminLanguage();
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
        image: "",
        priceCents: null,
        quantity: INTERNAL_AVAILABLE_STOCK_QUANTITY,
        active: true,
        sortOrder
      }
    ]);
  }

  return (
    <div className="admin-form-block sku-manager">
      <div className="product-gallery-heading">
        <div>
          <strong>{t("SKU / variações", "SKU / 商品规格")}</strong>
          <small>{t("Use para cor, tom, modelo ou tamanho. A disponibilidade do produto segue as variações ativas.", "用于颜色、色号、型号或尺寸；商品库存状态由启用的规格决定。")}</small>
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
                {t("Nome da variação", "规格名称")}
                <input
                  name={`skuName:${row.key}`}
                  onChange={(event) => updateRow(row.key, { name: event.target.value })}
                  placeholder={t("Ex: Cor 01, Rosa, 250 ml", "例如：01 色、粉色、250 ml")}
                  value={row.name}
                />
              </label>
              <label>
                {t("Código SKU", "SKU 编码")}
                <input
                  name={`skuCode:${row.key}`}
                  onChange={(event) => updateRow(row.key, { code: event.target.value })}
                  placeholder="Ex: RG-BASE-01"
                  value={row.code}
                />
              </label>
              <label>
                {t("Preço do SKU", "SKU 单价")}
                <input
                  defaultValue={formatImportMoney(row.basePriceCents ?? row.priceCents)}
                  inputMode="decimal"
                  name={`skuPrice:${row.key}`}
                  onChange={(event) => updateRow(row.key, { priceCents: parseCents(event.target.value) || null })}
                  placeholder={t("Em branco usa o preço principal", "留空时使用商品主价格")}
                />
              </label>
              <label className="sku-image-field">
                {t("Imagem do SKU", "SKU 图片")}
                <input
                  name={`skuImage:${row.key}`}
                  onChange={(event) => updateRow(row.key, { image: event.target.value })}
                  placeholder={t("URL da imagem desta variação", "该规格图片的 URL")}
                  value={row.image || ""}
                />
              </label>
              <label>
                {t("Disponibilidade", "库存状态")}
                <select
                  name={`skuQuantity:${row.key}`}
                  onChange={(event) => updateRow(row.key, { quantity: event.target.value === "in" ? INTERNAL_AVAILABLE_STOCK_QUANTITY : 0 })}
                  value={stockAvailabilityValue(row.quantity)}
                >
                  <option value="in">{t("Em estoque", "有货")}</option>
                  <option value="out">{t("Sem estoque", "缺货")}</option>
                </select>
              </label>
              <label>
                {t("Ordem", "排序")}
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
                {t("Ativa", "启用")}
              </label>
              <button className="button secondary" onClick={() => removeRow(row.key)} type="button">
                {t("Remover", "移除")}
              </button>
            </div>
          ))
        ) : (
          <div className="empty-state compact">
            <strong>{t("Sem variações cadastradas", "尚未创建商品规格")}</strong>
            <p>{t("Produtos sem SKU continuam usando a disponibilidade geral. Adicione variações quando houver cor, tom ou modelo.", "没有 SKU 的商品继续使用总体库存状态；有颜色、色号或型号时再添加规格。")}</p>
          </div>
        )}
      </div>

      <button className="button secondary" onClick={addRow} type="button">
        {t("Adicionar SKU", "添加 SKU")}
      </button>
      <p className="table-note">
        {t("Se houver SKU ativo, o cliente escolherá as variações na página do produto. Preço em branco usa o preço principal; peso segue o produto principal; imagem do SKU troca a foto principal quando cadastrada.", "存在启用的 SKU 时，客户将在商品页选择规格。SKU 价格留空时使用商品主价格；重量沿用主商品；填写 SKU 图片后，选中该规格会切换主图。")}
      </p>
    </div>
  );
}
