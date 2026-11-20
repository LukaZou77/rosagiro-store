// OrderItem.quantity is a PostgreSQL integer. Stock limits purchase quantity.
export const MAX_WHOLESALE_LINE_QUANTITY = 2_147_483_647;
export const MAX_WHOLESALE_ORDER_TOTAL_CENTS = 2_147_483_647;
export const wholesaleOrderTotalLimitNotice =
  "O valor deste pedido ultrapassa o limite aceito no site. Reduza a quantidade ou fale com o atendimento.";

export function normalizeWholesaleLineQuantity(value: unknown) {
  const quantity = Math.floor(Number(value));
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return Math.min(MAX_WHOLESALE_LINE_QUANTITY, quantity);
}

export function wholesaleReferenceUnitPriceCents(packagePriceCents: number, packagePieces: number) {
  return Math.round(packagePriceCents / packagePieces);
}

export function wholesaleMinimumRemainingCents(subtotalCents: number, minimumOrderCents: number) {
  return Math.max(0, minimumOrderCents - Math.max(0, subtotalCents));
}

export function wholesaleMinimumReached(subtotalCents: number, minimumOrderCents: number) {
  return wholesaleMinimumRemainingCents(subtotalCents, minimumOrderCents) === 0;
}

export function roundUpToWholesalePackage(
  quantity: unknown,
  packagePieces: unknown,
  maximumQuantity: unknown = MAX_WHOLESALE_LINE_QUANTITY
) {
  const normalizedQuantity = normalizeWholesaleLineQuantity(quantity);
  const normalizedPackage = normalizeWholesaleLineQuantity(packagePieces);
  if (normalizedQuantity <= 0 || normalizedPackage <= 0) return 0;

  const maximumCompleteQuantity = Math.floor(normalizeWholesaleLineQuantity(maximumQuantity) / normalizedPackage) * normalizedPackage;

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
  const normalizedPackage = normalizeWholesaleLineQuantity(packagePieces);
  if (!normalizedPackage) return normalizedCurrent;

  return Math.max(
    normalizedCurrent,
    roundUpToWholesalePackage(normalizedCurrent + normalizedPackage, normalizedPackage, maximumQuantity)
  );
}
