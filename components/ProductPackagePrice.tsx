import { money } from "@/lib/money";

export function ProductPackagePrice({
  packagePriceCents,
  packagePieces,
  unitPriceCents,
  className
}: {
  packagePriceCents: number | null;
  packagePieces: number | null;
  unitPriceCents: number;
  className?: string;
}) {
  if (!packagePriceCents || !packagePieces) return null;

  const unitLabel = packagePieces === 1 ? "unidade" : "unidades";

  return (
    <div
      className={className}
      aria-label={`Total da embalagem: ${money(packagePriceCents)}. ${packagePieces} ${unitLabel}, ${money(unitPriceCents)} por unidade.`}
    >
      <span>Total da embalagem</span>
      <strong>{money(packagePriceCents)}</strong>
      <small>
        {packagePieces} {unitLabel} · {money(unitPriceCents)} por unidade
      </small>
    </div>
  );
}
