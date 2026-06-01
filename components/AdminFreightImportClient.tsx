"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { money } from "@/lib/money";
import type { AnjunImportPreview } from "@/lib/shipping";

type ImportResult = {
  batchId: string;
  summary: AnjunImportPreview["summary"];
};

export function AdminFreightImportClient() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AnjunImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"idle" | "preview" | "import">("idle");

  async function submitFile(endpoint: string) {
    if (!file) throw new Error("Escolha a planilha .xlsx antes de continuar.");
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(endpoint, { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Nao foi possivel processar a planilha.");
    return data;
  }

  async function previewFile() {
    setBusy("preview");
    setMessage("");
    setResult(null);
    try {
      const nextPreview = (await submitFile("/api/admin/frete/preview")) as AnjunImportPreview;
      setPreview(nextPreview);
      setMessage(nextPreview.canImport ? "Pre-visualizacao pronta para confirmar." : "Revise os erros antes de importar.");
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : "Nao foi possivel pre-visualizar.");
    } finally {
      setBusy("idle");
    }
  }

  async function confirmImport() {
    setBusy("import");
    setMessage("");
    try {
      const nextResult = (await submitFile("/api/admin/frete/import")) as ImportResult;
      setResult(nextResult);
      setMessage("Tabela de frete importada e ativada.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel importar.");
    } finally {
      setBusy("idle");
    }
  }

  const summary = result?.summary || preview?.summary;
  const canImport = Boolean(file && preview?.canImport && busy === "idle");

  return (
    <div className="import-workspace">
      <section className="import-panel">
        <label>
          Planilha Anjun XLSX
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] || null;
              setFile(nextFile);
              setPreview(null);
              setResult(null);
              setMessage(nextFile ? "Clique em pre-visualizar para validar D2D Pickup." : "");
            }}
          />
        </label>
        <div className="field-helper">
          <strong>Servico</strong>
          <span>D2D Pickup</span>
          <strong>Origem de cotacao</strong>
          <span>SP-Sao Paulo</span>
          <strong>Arquivo</strong>
          <span>{file?.name || "Nenhum arquivo selecionado"}</span>
        </div>
        <button className="button secondary wide" type="button" disabled={!file || busy !== "idle"} onClick={() => void previewFile()}>
          {busy === "preview" ? "Lendo planilha..." : "Pre-visualizar tabela"}
        </button>
        <button className="button primary wide" type="button" disabled={!canImport} onClick={() => void confirmImport()}>
          {busy === "import" ? "Importando frete..." : "Confirmar importacao"}
        </button>
        <p className="table-note">
          O arquivo original fica no seu computador. O banco recebe somente linhas estruturadas de CEP, peso e preco.
        </p>
      </section>

      <section className="import-panel" aria-live="polite">
        <div className="import-summary">
          <span className={preview?.canImport || result ? "status-chip success" : "status-chip"}>
            {result ? "Importado" : preview ? (preview.canImport ? "Pronto para importar" : "Com erros") : "Aguardando pre-visualizacao"}
          </span>
          <span>{message || "Envie a planilha para validar linhas, UFs, zonas e preco de amostra."}</span>
        </div>

        {summary ? (
          <>
            <div className="import-kpis">
              <div>
                <span>Linhas D2D</span>
                <strong>{summary.workbookRows.toLocaleString("pt-BR")}</strong>
              </div>
              <div>
                <span>Importaveis</span>
                <strong>{summary.importableRows.toLocaleString("pt-BR")}</strong>
              </div>
              <div>
                <span>UFs</span>
                <strong>{summary.stateCount}</strong>
              </div>
              <div>
                <span>Zonas</span>
                <strong>{summary.zoneCount}</strong>
              </div>
            </div>
            <div className="freight-preview-card">
              <span>Amostra de cotacao</span>
              <strong>CEP {summary.sampleCep}</strong>
              <small>
                0,1 kg em SP-Sao Paulo: {summary.sampleRateCents ? money(summary.sampleRateCents) : "sem linha de amostra"}
              </small>
              <small>
                Origens na planilha: {summary.originCount}. O checkout usa SP-Sao Paulo nesta primeira versao.
              </small>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <strong>Importacao segura</strong>
            <p>Primeiro validamos a aba D2D Pickup, depois a confirmacao grava uma nova tabela ativa.</p>
          </div>
        )}

        {preview?.errors.length ? (
          <div className="form-error" role="alert">
            <strong>Erros encontrados</strong>
            <ul>
              {preview.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
