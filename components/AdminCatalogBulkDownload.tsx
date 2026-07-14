"use client";

import { useEffect, useState } from "react";
import { BookOpenText, Download, LoaderCircle } from "lucide-react";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { getCustomerCatalogCompleteDownloadData } from "@/app/admin/catalogo-clientes/actions";
import { customerCatalogCompleteFileName } from "@/lib/admin-customer-catalog-core";
import {
  buildCustomerCatalogCompletePdfDefinition,
  collectCustomerCatalogCompleteImageSources
} from "@/lib/admin-customer-catalog-pdf";
import styles from "./AdminCatalogBulkDownload.module.css";
import { useAdminLanguage } from "@/components/AdminLanguageProvider";

type PdfMakeClient = {
  addVirtualFileSystem: (vfs: Record<string, string>) => void;
  createPdf: (definition: TDocumentDefinitions) => {
    getBlob: (callback: (blob: Blob) => void) => void;
  };
};

function moduleDefault<T>(module: T | { default: T }): T {
  return typeof module === "object" && module !== null && "default" in module ? module.default : module;
}

function optimizedImageUrl(source: string, width: number) {
  return `/_next/image?url=${encodeURIComponent(source)}&w=${width}&q=75`;
}

async function fetchImageBlob(source: string, width: number) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const optimized = await fetch(optimizedImageUrl(source, width), { credentials: "same-origin" });
    if (optimized.ok) return optimized.blob();
    if (optimized.status < 500 || attempt === 2) break;
    await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
  }

  const fallback = await fetch(source, { credentials: "omit", mode: "cors" });
  if (!fallback.ok) throw new Error(`Imagem indisponível: ${source}`);
  return fallback.blob();
}

async function imageBlobToJpeg(blob: Blob, maxDimension: number, quality: number) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Não foi possível preparar uma imagem do catálogo.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

async function loadImageData(source: string, isHeader: boolean) {
  const maxDimension = isHeader ? 640 : 144;
  // Next/Image only accepts configured optimizer widths. 256 is the nearest
  // standard size above the PDF thumbnail target.
  const blob = await fetchImageBlob(source, isHeader ? 640 : 256);
  return imageBlobToJpeg(blob, maxDimension, isHeader ? 0.82 : 0.68);
}

async function loadImages(
  sources: string[],
  headerImage: string,
  onProgress: (completed: number, total: number) => void
) {
  const imageData = new Map<string, string>();
  let cursor = 0;
  let completed = 0;
  let failed = 0;

  async function worker() {
    while (cursor < sources.length) {
      const source = sources[cursor];
      cursor += 1;
      try {
        imageData.set(source, await loadImageData(source, source === headerImage));
      } catch {
        failed += 1;
      } finally {
        completed += 1;
        onProgress(completed, sources.length);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(6, sources.length) }, () => worker()));
  return { imageData, failed };
}

function createPdfBlob(pdfMake: PdfMakeClient, definition: TDocumentDefinitions) {
  return new Promise<Blob>((resolve, reject) => {
    try {
      pdfMake.createPdf(definition).getBlob(resolve);
    } catch (error) {
      reject(error);
    }
  });
}

function triggerDownload(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function AdminCatalogBulkDownload({
  brandCount,
  headerImage,
  minimumOrderCents,
  whatsapp
}: {
  brandCount: number;
  headerImage: string;
  minimumOrderCents: number;
  whatsapp: string;
}) {
  const { t } = useAdminLanguage();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  async function handleDownload() {
    if (running || !brandCount) return;
    setRunning(true);
    setFailed(false);
    setProgress(0);
    setDownloadUrl(null);

    try {
      setStatus(t("Carregando o gerador de PDF...", "正在加载 PDF 生成器……"));
      const [pdfMakeModule, pdfFontsModule] = await Promise.all([
        import("pdfmake/build/pdfmake"),
        import("pdfmake/build/vfs_fonts")
      ]);
      const pdfMake = moduleDefault(
        pdfMakeModule as unknown as PdfMakeClient | { default: PdfMakeClient }
      );
      const fontVfs = moduleDefault(
        pdfFontsModule as unknown as Record<string, string> | { default: Record<string, string> }
      );
      pdfMake.addVirtualFileSystem(fontVfs);
      setProgress(4);
      setStatus(t("Carregando todos os produtos ativos...", "正在读取全部启用商品……"));
      const completeData = await getCustomerCatalogCompleteDownloadData();
      const sources = collectCustomerCatalogCompleteImageSources(completeData, headerImage);
      const loaded = await loadImages(sources, headerImage, (completed, total) => {
        if (completed !== total && completed % 12 !== 0) return;
        setProgress(4 + Math.round((completed / Math.max(1, total)) * 84));
        setStatus(`${t("Preparando imagens", "正在处理图片")} · ${completed}/${total}`);
      });
      setProgress(92);
      setStatus(t("Montando um único PDF pesquisável...", "正在合并为一份可搜索的 PDF……"));
      const definition = buildCustomerCatalogCompletePdfDefinition(completeData, {
        headerImage,
        imageData: loaded.imageData,
        minimumOrderCents,
        whatsapp
      });
      const pdfBlob = await createPdfBlob(pdfMake, definition);
      const nextDownloadUrl = URL.createObjectURL(pdfBlob);
      setDownloadUrl(nextDownloadUrl);
      triggerDownload(nextDownloadUrl, customerCatalogCompleteFileName());
      setProgress(100);
      setStatus(
        loaded.failed
          ? t(`PDF completo concluído. ${loaded.failed} imagens indisponíveis foram ignoradas.`, `完整 PDF 已生成，${loaded.failed} 张无法读取的图片已跳过。`)
          : t(`PDF completo com ${completeData.brands.length} marcas pronto. Download iniciado.`, `包含 ${completeData.brands.length} 个品牌的完整 PDF 已生成并开始下载。`)
      );
    } catch (error) {
      setFailed(true);
      setStatus(error instanceof Error ? error.message : t("Não foi possível gerar o catálogo completo.", "无法生成完整目录。"));
    } finally {
      setRunning(false);
    }
  }

  return (
    // Browser translation rewrites text nodes and can break rapid React progress updates.
    <div className={`${styles.wrapper} notranslate`} translate="no">
      <button className={`button secondary ${styles.button}`} type="button" onClick={handleDownload} disabled={running}>
        {running ? <LoaderCircle className="admin-spin" size={17} /> : <BookOpenText size={17} />}
        {running ? t("Gerando catálogo completo...", "正在生成完整目录……") : t("Baixar catálogo completo", "下载完整总目录")}
      </button>
      <div className={`${styles.status}${failed ? ` ${styles.error}` : ""}`} aria-live="polite">
        <span>{status || t("Reúne todas as marcas em um único PDF pesquisável.", "把全部品牌合并为一份可搜索的 PDF。")}</span>
        {running || progress > 0 ? (
          <span className={styles.progressTrack} aria-hidden="true">
            <span className={styles.progressBar} style={{ width: `${progress}%` }} />
          </span>
        ) : null}
      </div>
      {downloadUrl && !running ? (
        <a className={`button primary ${styles.button}`} href={downloadUrl} download={customerCatalogCompleteFileName()}>
          <Download size={17} />
          {t("Baixar PDF completo", "下载完整 PDF")}
        </a>
      ) : null}
    </div>
  );
}
