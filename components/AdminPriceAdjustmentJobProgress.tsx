"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAdminLanguage } from "@/components/AdminLanguageProvider";

type PriceAdjustmentJob = {
  id: string;
  status: string;
  totalProducts: number;
  processedProducts: number;
  adjustedProducts: number;
  adjustedSkus: number;
  skippedProducts: number;
  skippedSkus: number;
  descriptionWarnings: number;
  error: string | null;
};

type JobResponse = {
  job?: PriceAdjustmentJob;
  error?: string;
};

type AdminPriceAdjustmentJobProgressProps = {
  jobId: string;
};

function resultUrl(pathname: string, job: PriceAdjustmentJob) {
  const params = new URLSearchParams({
    priceAdjusted: String(job.adjustedProducts),
    priceAdjustedSkus: String(job.adjustedSkus),
    priceSkippedProducts: String(job.skippedProducts),
    priceSkippedSkus: String(job.skippedSkus),
    priceWarnings: String(job.descriptionWarnings)
  });
  return `${pathname}?${params.toString()}`;
}

export function AdminPriceAdjustmentJobProgress({ jobId }: AdminPriceAdjustmentJobProgressProps) {
  const { t } = useAdminLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [job, setJob] = useState<PriceAdjustmentJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);
  const finishedRef = useRef(false);

  const percent = useMemo(() => {
    if (!job) return 0;
    if (job.status === "COMPLETED") return 100;
    if (!job.totalProducts) return 0;
    return Math.min(99, Math.floor((job.processedProducts / job.totalProducts) * 100));
  }, [job]);

  const runNextChunk = useCallback(async () => {
    if (processingRef.current || finishedRef.current) return;
    processingRef.current = true;

    try {
      const response = await fetch(`/api/admin/price-adjustments/${jobId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const payload = (await response.json()) as JobResponse;
      if (!response.ok || !payload.job) {
        throw new Error(payload.error || t("Não foi possível processar o ajuste.", "无法处理价格调整。"));
      }

      setJob(payload.job);
      if (payload.job.status === "COMPLETED") {
        finishedRef.current = true;
        router.replace(resultUrl(pathname, payload.job));
        router.refresh();
        return;
      }
      if (payload.job.status === "FAILED") {
        finishedRef.current = true;
        setError(payload.job.error || t("O ajuste foi interrompido.", "价格调整已中断。"));
        return;
      }
    } catch (caught) {
      finishedRef.current = true;
      setError(caught instanceof Error ? caught.message : t("Não foi possível processar o ajuste.", "无法处理价格调整。"));
    } finally {
      processingRef.current = false;
    }

  }, [jobId, pathname, router, t]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialJob() {
      try {
        const response = await fetch(`/api/admin/price-adjustments/${jobId}`);
        const payload = (await response.json()) as JobResponse;
        if (cancelled) return;
        if (!response.ok || !payload.job) {
          throw new Error(payload.error || t("Não foi possível carregar o ajuste.", "无法加载价格调整任务。"));
        }

        setJob(payload.job);
        if (payload.job.status === "COMPLETED") {
          finishedRef.current = true;
          router.replace(resultUrl(pathname, payload.job));
          router.refresh();
          return;
        }
        if (payload.job.status === "FAILED") {
          finishedRef.current = true;
          setError(payload.job.error || t("O ajuste foi interrompido.", "价格调整已中断。"));
          return;
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : t("Não foi possível carregar o ajuste.", "无法加载价格调整任务。"));
      }
    }

    void loadInitialJob();
    return () => {
      cancelled = true;
    };
  }, [jobId, pathname, router, t]);

  useEffect(() => {
    if (!job || error || finishedRef.current) return undefined;

    const timeout = window.setTimeout(() => {
      void runNextChunk();
    }, job.status === "PENDING" ? 0 : 250);

    return () => window.clearTimeout(timeout);
  }, [error, job, runNextChunk]);

  return (
    <section className={`admin-job-progress ${error ? "warning" : ""}`} aria-live="polite">
      <div className="admin-job-progress-heading">
        <div>
          <strong>{error ? t("Ajuste interrompido", "价格调整已中断") : t("Aplicando ajuste global de preços", "正在应用全局价格调整")}</strong>
          <small>
            {error
              ? error
              : t("Pode manter esta tela aberta. Se recarregar, o processamento continua a partir do progresso salvo.", "请保持此页面打开；即使刷新，也会从已保存的进度继续处理。")}
          </small>
        </div>
        <span>{percent}%</span>
      </div>
      <div className="admin-job-progress-bar" aria-label={t(`Progresso ${percent}%`, `进度 ${percent}%`)}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="admin-job-progress-grid">
        <span>
          {t("Processados", "已处理")} <strong>{job?.processedProducts || 0}</strong> / <strong>{job?.totalProducts || 0}</strong>
        </span>
        <span>
          {t("Produtos alterados", "已调整商品")} <strong>{job?.adjustedProducts || 0}</strong>
        </span>
        <span>
          {t("SKUs alterados", "已调整 SKU")} <strong>{job?.adjustedSkus || 0}</strong>
        </span>
        <span>
          {t("Ignorados", "已跳过")} <strong>{(job?.skippedProducts || 0) + (job?.skippedSkus || 0)}</strong>
        </span>
      </div>
    </section>
  );
}
