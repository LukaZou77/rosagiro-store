export const MAX_WHOLESALE_LINE_QUANTITY = 999;

export function normalizeWholesaleLineQuantity(value: unknown) {
  const quantity = Math.floor(Number(value) || 0);
  if (quantity <= 0) return 0;
  return Math.min(MAX_WHOLESALE_LINE_QUANTITY, quantity);
}

export function wholesaleMinimumRemainingCents(subtotalCents: number, minimumOrderCents: number) {
  return Math.max(0, minimumOrderCents - Math.max(0, subtotalCents));
}

export function wholesaleMinimumReached(subtotalCents: number, minimumOrderCents: number) {
  return wholesaleMinimumRemainingCents(subtotalCents, minimumOrderCents) === 0;
}

export function roundUpToWholesalePackage(quantity: unknown, packagePieces: unknown) {
  const normalizedQuantity = normalizeWholesaleLineQuantity(quantity);
  const normalizedPackage = Math.floor(Number(packagePieces) || 0);
  if (normalizedQuantity <= 0 || normalizedPackage <= 0) return 0;

  const maximumCompleteQuantity = Math.floor(MAX_WHOLESALE_LINE_QUANTITY / normalizedPackage) * normalizedPackage;
  if (maximumCompleteQuantity <= 0) return 0;

  return Math.min(
    Math.ceil(normalizedQuantity / normalizedPackage) * normalizedPackage,
    maximumCompleteQuantity
  );
}

export function addWholesalePackageQuantity(
  currentQuantity: unknown,
  packagePieces: unknown,
  maximumQuantity: unknown = MAX_WHOLESALE_LINE_QUANTITY
) {
  const normalizedCurrent = normalizeWholesaleLineQuantity(currentQuantity);
  const normalizedPackage = Math.floor(Number(packagePieces) || 0);
  const normalizedMaximum = normalizeWholesaleLineQuantity(maximumQuantity);
  if (normalizedPackage <= 0 || normalizedMaximum < normalizedPackage) return 0;

  const maximumCompleteQuantity = Math.floor(normalizedMaximum / normalizedPackage) * normalizedPackage;
  const nextQuantity = normalizedCurrent <= 0
    ? normalizedPackage
    : Math.ceil((normalizedCurrent + normalizedPackage) / normalizedPackage) * normalizedPackage;

  return Math.min(nextQuantity, maximumCompleteQuantity);
}
