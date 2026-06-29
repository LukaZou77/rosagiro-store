"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

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
        throw new Error(payload.error || "Não foi possível processar o ajuste.");
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
        setError(payload.job.error || "O ajuste foi interrompido.");
        return;
      }
    } catch (caught) {
      finishedRef.current = true;
      setError(caught instanceof Error ? caught.message : "Não foi possível processar o ajuste.");
    } finally {
      processingRef.current = false;
    }

  }, [jobId, pathname, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialJob() {
      try {
        const response = await fetch(`/api/admin/price-adjustments/${jobId}`);
        const payload = (await response.json()) as JobResponse;
        if (cancelled) return;
        if (!response.ok || !payload.job) {
          throw new Error(payload.error || "Não foi possível carregar o ajuste.");
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
          setError(payload.job.error || "O ajuste foi interrompido.");
          return;
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Não foi possível carregar o ajuste.");
      }
    }

    void loadInitialJob();
    return () => {
      cancelled = true;
    };
  }, [jobId, pathname, router]);

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
          <strong>{error ? "Ajuste interrompido" : "Aplicando ajuste global de preços"}</strong>
          <small>
            {error
              ? error
              : "Pode manter esta tela aberta. Se recarregar, o processamento continua a partir do progresso salvo."}
          </small>
        </div>
        <span>{percent}%</span>
      </div>
      <div className="admin-job-progress-bar" aria-label={`Progresso ${percent}%`}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="admin-job-progress-grid">
        <span>
          Processados <strong>{job?.processedProducts || 0}</strong> de <strong>{job?.totalProducts || 0}</strong>
        </span>
        <span>
          Produtos alterados <strong>{job?.adjustedProducts || 0}</strong>
        </span>
        <span>
          SKUs alterados <strong>{job?.adjustedSkus || 0}</strong>
        </span>
        <span>
          Ignorados <strong>{(job?.skippedProducts || 0) + (job?.skippedSkus || 0)}</strong>
        </span>
      </div>
    </section>
  );
}
