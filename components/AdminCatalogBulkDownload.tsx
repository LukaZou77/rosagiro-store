"use client";

import { useState } from "react";
import { Archive, LoaderCircle } from "lucide-react";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { getCustomerCatalogBrandDownloadData } from "@/app/admin/catalogo-clientes/actions";
import { customerCatalogBrandFileName } from "@/lib/admin-customer-catalog-core";
import {
  buildCustomerCatalogPdfDefinition,
  collectCustomerCatalogImageSources
} from "@/lib/admin-customer-catalog-pdf";
import styles from "./AdminCatalogBulkDownload.module.css";

type BrandOption = { id: string; name: string };

type PdfMakeClient = {
  addVirtualFileSystem: (vfs: Record<string, string>) => void;
  createPdf: (definition: TDocumentDefinitions) => {
    getBlob: (callback: (blob: Blob) => void) => void;
  };
};

type ZipClient = {
  file: (name: string, data: Blob) => void;
  generateAsync: (
    options: {
      type: "blob";
      compression: "STORE";
      mimeType: string;
      streamFiles: boolean;
    },
    onUpdate: (metadata: { percent: number; currentFile: string | null }) => void
  ) => Promise<Blob>;
};

type ZipConstructor = new () => ZipClient;

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

async function imageBlobToJpeg(blob: Blob, maxDimension: number) {
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
  return canvas.toDataURL("image/jpeg", 0.74);
}

async function loadImageData(source: string, isHeader: boolean) {
  const maxDimension = isHeader ? 640 : 160;
  // Next/Image only accepts configured optimizer widths. 256 is the nearest
  // standard size above the 160 px PDF thumbnail target.
  const blob = await fetchImageBlob(source, isHeader ? 640 : 256);
  return imageBlobToJpeg(blob, maxDimension);
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

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function AdminCatalogBulkDownload({
  brands,
  headerImage,
  minimumOrderCents,
  whatsapp
}: {
  brands: BrandOption[];
  headerImage: string;
  minimumOrderCents: number;
  whatsapp: string;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Gera um PDF por marca e reúne tudo em um arquivo ZIP.");
  const [failed, setFailed] = useState(false);

  async function handleDownload() {
    if (running || !brands.length) return;
    setRunning(true);
    setFailed(false);
    setProgress(0);

    try {
      setStatus("Carregando o gerador de PDF...");
      const [zipModule, pdfMakeModule, pdfFontsModule] = await Promise.all([
        import("jszip"),
        import("pdfmake/build/pdfmake"),
        import("pdfmake/build/vfs_fonts")
      ]);
      const JSZip = moduleDefault(
        zipModule as unknown as ZipConstructor | { default: ZipConstructor }
      );
      const pdfMake = moduleDefault(
        pdfMakeModule as unknown as PdfMakeClient | { default: PdfMakeClient }
      );
      const fontVfs = moduleDefault(
        pdfFontsModule as unknown as Record<string, string> | { default: Record<string, string> }
      );
      pdfMake.addVirtualFileSystem(fontVfs);
      const zip = new JSZip();
      let imageFailures = 0;

      for (let index = 0; index < brands.length; index += 1) {
        const brand = brands[index];
        const basePercent = (index / brands.length) * 90;
        setStatus(`${index + 1}/${brands.length} · ${brand.name} · preparando dados`);
        setProgress(Math.round(basePercent));
        const data = await getCustomerCatalogBrandDownloadData(brand.id);
        const sources = collectCustomerCatalogImageSources(data, headerImage);
        const loaded = await loadImages(sources, headerImage, (completed, total) => {
          if (completed !== total && completed % 8 !== 0) return;
          const brandPercent = total ? (completed / total) * (90 / brands.length) : 0;
          setProgress(Math.min(90, Math.round(basePercent + brandPercent)));
          setStatus(`${index + 1}/${brands.length} · ${brand.name} · imagens ${completed}/${total}`);
        });
        imageFailures += loaded.failed;
        setStatus(`${index + 1}/${brands.length} · ${brand.name} · gerando PDF`);
        const definition = buildCustomerCatalogPdfDefinition(data, {
          headerImage,
          imageData: loaded.imageData,
          minimumOrderCents,
          whatsapp
        });
        const pdfBlob = await createPdfBlob(pdfMake, definition);
        zip.file(`${customerCatalogBrandFileName(brand.name)}.pdf`, pdfBlob);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }

      setStatus("Compactando os PDFs...");
      const zipBlob = await zip.generateAsync(
        {
          type: "blob",
          compression: "STORE",
          mimeType: "application/zip",
          streamFiles: true
        },
        (metadata) => setProgress(90 + Math.round(metadata.percent / 10))
      );
      downloadBlob(zipBlob, "Catálogos RosaGiro - todas as marcas.zip");
      setProgress(100);
      setStatus(
        imageFailures
          ? `${brands.length} PDFs concluídos. ${imageFailures} imagens indisponíveis foram ignoradas.`
          : `${brands.length} PDFs concluídos e baixados.`
      );
    } catch (error) {
      setFailed(true);
      setStatus(error instanceof Error ? error.message : "Não foi possível gerar todos os catálogos.");
    } finally {
      setRunning(false);
    }
  }

  return (
    // Browser translation rewrites text nodes and can break rapid React progress updates.
    <div className={`${styles.wrapper} notranslate`} translate="no">
      <button className={`button secondary ${styles.button}`} type="button" onClick={handleDownload} disabled={running}>
        {running ? <LoaderCircle className="admin-spin" size={17} /> : <Archive size={17} />}
        {running ? "Gerando catálogos..." : "Baixar todas as marcas"}
      </button>
      <div className={`${styles.status}${failed ? ` ${styles.error}` : ""}`} aria-live="polite">
        <span>{status}</span>
        {running || progress > 0 ? (
          <span className={styles.progressTrack} aria-hidden="true">
            <span className={styles.progressBar} style={{ width: `${progress}%` }} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
