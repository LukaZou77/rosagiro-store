export const INTERNAL_AVAILABLE_STOCK_QUANTITY = 999;

export function stockAvailabilityValue(quantity: number | null | undefined) {
  return (quantity || 0) > 0 ? "in" : "out";
}

export function stockQuantityFromAvailability(value: string | null | undefined) {
  return value === "in" ? INTERNAL_AVAILABLE_STOCK_QUANTITY : 0;
}

export function stockQuantityFromImport(stock: number) {
  return stock > 0 ? INTERNAL_AVAILABLE_STOCK_QUANTITY : 0;
}
