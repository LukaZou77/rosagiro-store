"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { money } from "@/lib/money";
import type { AnjunImportPreview } from "@/lib/shipping";
import { useAdminLanguage } from "@/components/AdminLanguageProvider";

type ImportResult = {
  batchId: string;
  summary: AnjunImportPreview["summary"];
};

export function AdminFreightImportClient() {
  const { locale, t } = useAdminLanguage();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AnjunImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"idle" | "preview" | "import">("idle");

  async function submitFile(endpoint: string) {
    if (!file) throw new Error(t("Escolha a planilha .xlsx antes de continuar.", "请先选择 .xlsx 表格。"));
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(endpoint, { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || t("Não foi possível processar a planilha.", "无法处理表格。"));
    return data;
  }

  async function previewFile() {
    setBusy("preview");
    setMessage("");
    setResult(null);
    try {
      const nextPreview = (await submitFile("/api/admin/frete/preview")) as AnjunImportPreview;
      setPreview(nextPreview);
      setMessage(nextPreview.canImport ? t("Pré-visualização pronta para confirmar.", "预览完成，可以确认导入。") : t("Revise os erros antes de importar.", "导入前请检查错误。"));
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : t("Não foi possível pré-visualizar.", "无法生成预览。"));
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
      setMessage(t("Tabela de frete importada e ativada.", "运费表已导入并启用。"));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("Não foi possível importar.", "无法导入。"));
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
          {t("Planilha Anjun XLSX", "Anjun XLSX 表格")}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] || null;
              setFile(nextFile);
              setPreview(null);
              setResult(null);
              setMessage(nextFile ? t("Clique em pré-visualizar para validar D2D Pickup.", "点击预览以验证 D2D Pickup 数据。") : "");
            }}
          />
        </label>
        <div className="field-helper">
          <strong>{t("Serviço", "服务")}</strong>
          <span>D2D Pickup</span>
          <strong>{t("Origem de cotação", "报价发货地")}</strong>
          <span>SP-São Paulo</span>
          <strong>{t("Arquivo", "文件")}</strong>
          <span>{file?.name || t("Nenhum arquivo selecionado", "未选择文件")}</span>
        </div>
        <button className="button secondary wide" type="button" disabled={!file || busy !== "idle"} onClick={() => void previewFile()}>
          {busy === "preview" ? t("Lendo planilha...", "正在读取表格……") : t("Pre-visualizar tabela", "预览运费表")}
        </button>
        <button className="button primary wide" type="button" disabled={!canImport} onClick={() => void confirmImport()}>
          {busy === "import" ? t("Importando frete...", "正在导入运费……") : t("Confirmar importação", "确认导入")}
        </button>
        <p className="table-note">
          {t("O arquivo original fica no seu computador. O banco recebe somente linhas estruturadas de CEP, peso e preço.", "原始文件保留在本机，数据库只接收结构化的 CEP、重量和价格数据。")}
        </p>
      </section>

      <section className="import-panel" aria-live="polite">
        <div className="import-summary">
          <span className={preview?.canImport || result ? "status-chip success" : "status-chip"}>
            {result ? t("Importado", "已导入") : preview ? (preview.canImport ? t("Pronto para importar", "可以导入") : t("Com erros", "存在错误")) : t("Aguardando pré-visualização", "等待预览")}
          </span>
          <span>{message || t("Envie a planilha para validar linhas, UFs, zonas e preço de amostra.", "上传表格后将验证行数、州、区域和示例价格。")}</span>
        </div>

        {summary ? (
          <>
            <div className="import-kpis">
              <div>
                <span>{t("Linhas D2D", "D2D 行数")}</span>
                <strong>{summary.workbookRows.toLocaleString(locale)}</strong>
              </div>
              <div>
                <span>{t("Importaveis", "可导入")}</span>
                <strong>{summary.importableRows.toLocaleString(locale)}</strong>
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
              <span>{t("Amostra de cotação", "报价示例")}</span>
              <strong>CEP {summary.sampleCep}</strong>
              <small>
                0,1 kg {t("em SP-São Paulo: ", "从 SP-São Paulo 发货：")}{summary.sampleRateCents ? money(summary.sampleRateCents) : t("sem linha de amostra", "无示例费率")}
              </small>
              <small>
                {t("Origens na planilha: ", "表格中的发货地数量：")}{summary.originCount}{t(". O checkout usa SP-São Paulo nesta primeira versão.", "。当前结账版本使用 SP-São Paulo 作为发货地。")}
              </small>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <strong>{t("Importação segura", "安全导入")}</strong>
            <p>{t("Primeiro validamos a aba D2D Pickup, depois a confirmação grava uma nova tabela ativa.", "系统会先验证 D2D Pickup 工作表，确认后才写入并启用新的运费表。")}</p>
          </div>
        )}

        {preview?.errors.length ? (
          <div className="form-error" role="alert">
            <strong>{t("Erros encontrados", "发现错误")}</strong>
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
