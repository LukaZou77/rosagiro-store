"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";

type AdminPriceAdjustmentResultDialogProps = {
  productCount: number;
  skuCount: number;
  skippedProductCount: number;
  skippedSkuCount: number;
  descriptionWarningCount: number;
};

const RESULT_PARAM_KEYS = [
  "priceAdjusted",
  "priceAdjustedSkus",
  "priceSkipped",
  "priceSkippedProducts",
  "priceSkippedSkus",
  "priceWarnings"
];

function plural(count: number, singular: string, pluralLabel: string) {
  return count === 1 ? singular : pluralLabel;
}

export function AdminPriceAdjustmentResultDialog({
  productCount,
  skuCount,
  skippedProductCount,
  skippedSkuCount,
  descriptionWarningCount
}: AdminPriceAdjustmentResultDialogProps) {
  const [open, setOpen] = useState(true);
  const titleId = useId();
  const skippedTotal = skippedProductCount + skippedSkuCount;
  const isComplete = skippedTotal === 0 && descriptionWarningCount === 0;
  const title = isComplete ? "Ajuste concluído em todos os itens." : "Ajuste concluído parcialmente.";

  const detailLines = useMemo(
    () => [
      `${productCount} ${plural(productCount, "produto alterado", "produtos alterados")}.`,
      `${skuCount} ${plural(skuCount, "SKU alterado", "SKUs alterados")}.`,
      skippedTotal > 0
        ? `${skippedProductCount} ${plural(skippedProductCount, "produto ignorado", "produtos ignorados")} e ${skippedSkuCount} ${plural(
            skippedSkuCount,
            "SKU ignorado",
            "SKUs ignorados"
          )} por preço mínimo.`
        : "Nenhum produto ou SKU foi ignorado por preço mínimo.",
      descriptionWarningCount > 0
        ? `${descriptionWarningCount} ${plural(
            descriptionWarningCount,
            "descrição personalizada não foi alterada",
            "descrições personalizadas não foram alteradas"
          )}.`
        : "Todas as descrições padrão elegíveis foram atualizadas."
    ],
    [descriptionWarningCount, productCount, skippedProductCount, skippedSkuCount, skippedTotal, skuCount]
  );

  const closeDialog = useCallback(() => {
    setOpen(false);

    const url = new URL(window.location.href);
    for (const key of RESULT_PARAM_KEYS) {
      url.searchParams.delete(key);
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, "", nextUrl || url.pathname);
  }, []);

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeDialog();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [closeDialog, open]);

  if (!open) return null;

  return (
    <div className="admin-result-dialog-backdrop" role="presentation">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={`admin-result-dialog ${isComplete ? "success" : "warning"}`}
        role="dialog"
      >
        <div className="admin-result-dialog-status">{isComplete ? "Concluído" : "Atenção"}</div>
        <h2 id={titleId}>{title}</h2>
        <ul>
          {detailLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <button className="button primary" onClick={closeDialog} type="button">
          Entendi
        </button>
      </section>
    </div>
  );
}
