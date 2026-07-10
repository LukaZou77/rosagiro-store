export const checkoutShippingMethods = ["ANJUN_D2D_PICKUP", "RETIRADA_LOCAL"] as const;

export type CheckoutShippingMethod = (typeof checkoutShippingMethods)[number];

export const shippingWeightConfig = {
  packagingWeightGrams: 150,
  minBillableWeightGrams: 100,
  fallbackProductWeightGrams: 150
} as const;

export function parseCheckoutShippingMethod(value: unknown): CheckoutShippingMethod | null {
  const normalized = String(value || "").trim().toUpperCase();
  return checkoutShippingMethods.includes(normalized as CheckoutShippingMethod)
    ? (normalized as CheckoutShippingMethod)
    : null;
}

export function productWeightGrams(weightGrams: number | null | undefined) {
  if (!weightGrams || weightGrams <= 0) return shippingWeightConfig.fallbackProductWeightGrams;
  return Math.max(1, Math.floor(weightGrams));
}

export function billableWeightGrams(productTotalWeightGrams: number) {
  return Math.max(
    shippingWeightConfig.minBillableWeightGrams,
    productTotalWeightGrams + shippingWeightConfig.packagingWeightGrams
  );
}
