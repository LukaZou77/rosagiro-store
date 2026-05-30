"use client";

import { useMemo, useState } from "react";
import { money } from "@/lib/money";
import {
  parseProductCsv,
  productImportOptionalFields,
  productImportRequiredFields
} from "@/lib/product-import-shared";

export function AdminProductImportClient() {
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const preview = useMemo(() => parseProductCsv(csvText), [csvText]);
  const hasCsv = Boolean(csvText.trim());
  const canImport = hasCsv && preview.rows.length > 0 && preview.errorCount === 0;

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsvText(await file.text());
  }

  return (
    <div className="import-workspace">
      <div className="import-panel">
        <label>
          Arquivo CSV
          <input type="file" accept=".csv,text/csv" onChange={onFileChange} />
        </label>
        <label>
          Conteudo do CSV
          <textarea
            className="csv-textarea"
            name="csvText"
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            placeholder="Cole aqui o conteudo do CSV ou escolha um arquivo."
          />
        </label>
        <div className="field-helper">
          <strong>Campos obrigatorios</strong>
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

        {hasCsv && preview.missingHeaders.length ? (
          <div className="form-error" role="alert">
            Campos ausentes: {preview.missingHeaders.join(", ")}
          </div>
        ) : null}

        {hasCsv ? (
          <div className="preview-table-wrap">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Produto</th>
                  <th>Marca</th>
                  <th>Categoria</th>
                  <th>Preco</th>
                  <th>Estoque</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 12).map((row) => (
                  <tr key={row.rowNumber} className={row.errors.length ? "has-error" : ""}>
                    <td>{row.rowNumber}</td>
                    <td>
                      <strong>{row.name || "-"}</strong>
                      <small>{row.slug || "sem slug"}</small>
                    </td>
                    <td>{row.brand || "-"}</td>
                    <td>{row.category || "-"}</td>
                    <td>{row.priceCents > 0 ? money(row.priceCents) : "-"}</td>
                    <td>{row.stock}</td>
                    <td>{row.errors.length ? row.errors.join("; ") : "OK"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 12 ? <p className="table-note">Mostrando 12 de {preview.rows.length} linhas.</p> : null}
          </div>
        ) : (
          <div className="empty-state">
            <strong>Importacao flexivel</strong>
            <p>Escolha um CSV para pre-visualizar produtos, erros e estoque antes de gravar no banco.</p>
          </div>
        )}

        <button className="button primary wide" type="submit" disabled={!canImport}>
          Confirmar importacao
        </button>
      </div>
    </div>
  );
}
