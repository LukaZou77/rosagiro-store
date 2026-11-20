import { money } from "@/lib/money";

export function ProductPackagePrice({
  packagePriceCents,
  packagePieces,
  unitPriceCents = null,
  unitPriceLabel,
  className
}: {
  packagePriceCents: number | null;
  packagePieces: number | null;
  unitPriceCents?: number | null;
  unitPriceLabel?: string;
  className?: string;
}) {
  if (!packagePriceCents || !packagePieces) return null;

  const unitLabel = packagePieces === 1 ? "unidade" : "unidades";
  const unitReference = unitPriceCents === null ? "" : unitPriceLabel
    ? `${unitPriceLabel} ${money(unitPriceCents)}`
    : `aprox. ${money(unitPriceCents)} por unidade`;

  return (
    <div
      className={className}
      aria-label={`Total da embalagem: ${money(packagePriceCents)}. ${packagePieces} ${unitLabel}${unitReference ? `, ${unitReference}` : ""}.`}
    >
      <span>Total da embalagem</span>
      <strong>{money(packagePriceCents)}</strong>
      <small>
        {packagePieces} {unitLabel}{unitReference ? ` · ${unitReference}` : null}
      </small>
    </div>
  );
}
