"use client";

import { useMemo, useState } from "react";
import { money } from "@/lib/money";
import { useAdminLanguage } from "@/components/AdminLanguageProvider";
import {
  parseProductCsv,
  productImportOptionalFields,
  productImportRequiredFields,
  type ProductImportExistingProduct
} from "@/lib/product-import-shared";

export function AdminProductImportClient({
  existingProducts
}: {
  existingProducts: ProductImportExistingProduct[];
}) {
  const { t } = useAdminLanguage();
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const preview = useMemo(() => parseProductCsv(csvText, { existingProducts }), [csvText, existingProducts]);
  const hasCsv = Boolean(csvText.trim());
  const canImport = hasCsv && preview.rows.length > 0 && preview.errorCount === 0;

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsvText(await file.text());
  }

  function delta(value: number | null, formatter: (input: number) => string) {
    if (value === null || value === 0) return t("sem mudança", "无变化");
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${formatter(value)}`;
  }

  function availability(value: number) {
    return value > 0 ? t("Em estoque", "有货") : t("Sem estoque", "缺货");
  }

  function availabilityDelta(value: number | null) {
    if (value === null || value === 0) return t("sem mudança", "无变化");
    return value > 0 ? t("mudará para Em estoque", "将变为有货") : t("mudará para Sem estoque", "将变为缺货");
  }

  return (
    <div className="import-workspace">
      <div className="import-panel">
        <label>
          {t("Arquivo CSV", "CSV 文件")}
          <input type="file" accept=".csv,text/csv" onChange={onFileChange} />
        </label>
        <label>
          {t("Conteúdo do CSV", "CSV 内容")}
          <textarea
            className="csv-textarea"
            name="csvText"
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            placeholder={t("Cole aqui o conteúdo do CSV ou escolha um arquivo.", "在此粘贴 CSV 内容或选择文件。")}
          />
        </label>
        <div className="field-helper">
          <strong>{t("Campos obrigatórios", "必填字段")}</strong>
          <span>{productImportRequiredFields.join(", ")}</span>
          <strong>{t("Campos opcionais", "选填字段")}</strong>
          <span>{productImportOptionalFields.join(", ")}</span>
        </div>
      </div>

      <div className="import-panel" aria-live="polite">
        <div className="import-summary">
          <span className={canImport ? "status-chip success" : "status-chip"}>
            {canImport ? t("Pronto para importar", "可以导入") : hasCsv ? t("Revise o CSV", "请检查 CSV") : t("Aguardando arquivo", "等待文件")}
          </span>
          <span>{fileName || t("Nenhum arquivo selecionado", "未选择文件")}</span>
        </div>

        {hasCsv ? (
          <div className="import-kpis">
            <div>
              <span>{t("Linhas", "行数")}</span>
              <strong>{preview.summary.totalRows}</strong>
            </div>
            <div>
              <span>{t("Criar", "新建")}</span>
              <strong>{preview.summary.createCount}</strong>
            </div>
            <div>
              <span>{t("Atualizar", "更新")}</span>
              <strong>{preview.summary.updateCount}</strong>
            </div>
            <div>
              <span>{t("Erros", "错误")}</span>
              <strong>{preview.errorCount}</strong>
            </div>
          </div>
        ) : null}

        {hasCsv && preview.missingHeaders.length ? (
          <div className="form-error" role="alert">
            {t("Campos ausentes: ", "缺少字段：")}{preview.missingHeaders.join(", ")}
          </div>
        ) : null}

        {hasCsv && preview.summary.duplicateSlugCount ? (
          <div className="form-error" role="alert">
            {t("Existem", "CSV 中有")} {preview.summary.duplicateSlugCount} {t("linhas com slug duplicado no CSV.", "行使用了重复 slug。")}
          </div>
        ) : null}

        {hasCsv ? (
          <div className="preview-table-wrap">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>{t("Linha", "行")}</th>
                  <th>{t("Ação", "操作")}</th>
                  <th>{t("Produto", "商品")}</th>
                  <th>{t("Marca / categoria", "品牌 / 品类")}</th>
                  <th>{t("Preco", "价格")}</th>
                  <th>{t("Disponibilidade", "库存状态")}</th>
                  <th>{t("Imagem", "图片")}</th>
                  <th>{t("Status", "状态")}</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 20).map((row) => (
                  <tr key={`${row.rowNumber}-${row.slug}`} className={row.errors.length ? "has-error" : ""}>
                    <td>{row.rowNumber}</td>
                    <td>
                      <span className={row.operation === "create" ? "status-chip success" : "status-chip"}>
                        {row.operation === "create" ? t("Criar", "新建") : t("Atualizar", "更新")}
                      </span>
                    </td>
                    <td>
                      <strong>{row.name || "-"}</strong>
                      <small>{row.slug || t("sem slug", "无 slug")}</small>
                    </td>
                    <td>
                      <strong>{row.brand || "-"}</strong>
                      <small>{row.category || "-"} / {row.subcategory || "-"}</small>
                    </td>
                    <td>
                      {row.priceCents > 0 ? money(row.priceCents) : "-"}
                      <small>{delta(row.priceDeltaCents, money)}</small>
                    </td>
                    <td>
                      {availability(row.stock)}
                      <small>{availabilityDelta(row.stockDelta)}</small>
                    </td>
                    <td>
                      {row.image ? <img className="preview-thumb" src={row.image} alt="" loading="lazy" /> : "-"}
                      <small>{row.image || t("sem imagem", "无图片")}</small>
                      <small>{row.gallery.length} {t("imagem(ns) na galeria", "张图库图片")}</small>
                    </td>
                    <td>{row.errors.length ? row.errors.join("; ") : "OK"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 20 ? <p className="table-note">{t("Mostrando 20 de", "显示 20 行，共")} {preview.rows.length} {t("linhas.", "行。")}</p> : null}
          </div>
        ) : (
          <div className="empty-state">
            <strong>{t("Importação flexível", "灵活导入")}</strong>
            <p>{t("Escolha um CSV para pré-visualizar criações, atualizações, erros, estoque e imagens antes de gravar.", "选择 CSV 后，可在写入前预览新建、更新、错误、库存和图片变化。")}</p>
          </div>
        )}

        <button className="button primary wide" type="submit" disabled={!canImport}>
          {t("Confirmar importação", "确认导入")}
        </button>
      </div>
    </div>
  );
}
