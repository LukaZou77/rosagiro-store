"use client";

import { useMemo, useState } from "react";
import { money } from "@/lib/money";
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
    if (value === null || value === 0) return "sem mudança";
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${formatter(value)}`;
  }

  return (
    <div className="import-workspace">
      <div className="import-panel">
        <label>
          Arquivo CSV
          <input type="file" accept=".csv,text/csv" onChange={onFileChange} />
        </label>
        <label>
          Conteúdo do CSV
          <textarea
            className="csv-textarea"
            name="csvText"
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            placeholder="Cole aqui o conteúdo do CSV ou escolha um arquivo."
          />
        </label>
        <div className="field-helper">
          <strong>Campos obrigatórios</strong>
          <span>{productImportRequiredFields.join(", ")}</span>
          <strong>Campos opcionais</strong>
          <span>{productImportOptionalFields.join(", ")}</span>
        </div>
      </div>

      <div className="import-panel" aria-live="polite">
        <div className="import-summary">
          <span className={canImport ? "status-chip success" : "status-chip"}>
            {canImport ? "Pronto para importar" : hasCsv ? "Revise o CSV" : "Aguardando arquivo"}
          </span>
          <span>{fileName || "Nenhum arquivo selecionado"}</span>
        </div>

        {hasCsv ? (
          <div className="import-kpis">
            <div>
              <span>Linhas</span>
              <strong>{preview.summary.totalRows}</strong>
            </div>
            <div>
              <span>Criar</span>
              <strong>{preview.summary.createCount}</strong>
            </div>
            <div>
              <span>Atualizar</span>
              <strong>{preview.summary.updateCount}</strong>
            </div>
            <div>
              <span>Erros</span>
              <strong>{preview.errorCount}</strong>
            </div>
          </div>
        ) : null}

        {hasCsv && preview.missingHeaders.length ? (
          <div className="form-error" role="alert">
            Campos ausentes: {preview.missingHeaders.join(", ")}
          </div>
        ) : null}

        {hasCsv && preview.summary.duplicateSlugCount ? (
          <div className="form-error" role="alert">
            Existem {preview.summary.duplicateSlugCount} linhas com slug duplicado no CSV.
          </div>
        ) : null}

        {hasCsv ? (
          <div className="preview-table-wrap">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Ação</th>
                  <th>Produto</th>
                  <th>Marca / categoria</th>
                  <th>Preco</th>
                  <th>Estoque</th>
                  <th>Imagem</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 20).map((row) => (
                  <tr key={`${row.rowNumber}-${row.slug}`} className={row.errors.length ? "has-error" : ""}>
                    <td>{row.rowNumber}</td>
                    <td>
                      <span className={row.operation === "create" ? "status-chip success" : "status-chip"}>
                        {row.operation === "create" ? "Criar" : "Atualizar"}
                      </span>
                    </td>
                    <td>
                      <strong>{row.name || "-"}</strong>
                      <small>{row.slug || "sem slug"}</small>
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
                      {row.stock}
                      <small>{delta(row.stockDelta, (value) => `${value} un.`)}</small>
                    </td>
                    <td>
                      {row.image ? <img className="preview-thumb" src={row.image} alt="" loading="lazy" /> : "-"}
                      <small>{row.image || "sem imagem"}</small>
                      <small>{row.gallery.length} imagem(ns) na galeria</small>
                    </td>
                    <td>{row.errors.length ? row.errors.join("; ") : "OK"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 20 ? <p className="table-note">Mostrando 20 de {preview.rows.length} linhas.</p> : null}
          </div>
        ) : (
          <div className="empty-state">
            <strong>Importação flexível</strong>
            <p>Escolha um CSV para pré-visualizar criações, atualizações, erros, estoque e imagens antes de gravar.</p>
          </div>
        )}

        <button className="button primary wide" type="submit" disabled={!canImport}>
          Confirmar importação
        </button>
      </div>
    </div>
  );
}
