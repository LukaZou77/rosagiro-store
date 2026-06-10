import type { CatalogProduct } from "@/lib/catalog";

export type ProductStockTone = "ready" | "low" | "out";

export function productDiscountPercent(product: Pick<CatalogProduct, "compareAtPriceCents" | "priceCents">) {
  if (!product.compareAtPriceCents || product.compareAtPriceCents <= product.priceCents) return 0;
  return Math.round((1 - product.priceCents / product.compareAtPriceCents) * 100);
}

type StockSource = Pick<CatalogProduct, "inventory"> & {
  skus?: Array<{ quantity: number; active: boolean }>;
};

export function productHasActiveSkus(product: StockSource) {
  return Boolean(product.skus?.some((sku) => sku.active));
}

export function productQuantity(product: StockSource) {
  if (productHasActiveSkus(product)) {
    return (product.skus || []).reduce((total, sku) => (sku.active ? total + Math.max(0, sku.quantity) : total), 0);
  }
  return product.inventory?.quantity || 0;
}

export function productStockTone(product: StockSource): ProductStockTone {
  const quantity = productQuantity(product);
  if (quantity <= 0) return "out";
  return "ready";
}

export function productStockLabel(product: StockSource) {
  const quantity = productQuantity(product);
  if (quantity <= 0) return "Sem estoque";
  return "Em estoque";
}

export function productShortStockLabel(product: StockSource) {
  return productStockLabel(product);
}

export function productHeroBadge(product: Pick<CatalogProduct, "badges" | "compareAtPriceCents" | "priceCents" | "inventory" | "stockStatus"> & { skus?: Array<{ quantity: number; active: boolean }> }) {
  const discount = productDiscountPercent(product);
  if (discount > 0) return `${discount}% OFF`;
  if (productStockTone(product) === "ready") return "Pronta entrega";
  return product.badges[0] || product.stockStatus;
}

export function productPurchaseSignals(product: Pick<CatalogProduct, "volume" | "badges" | "inventory" | "compareAtPriceCents" | "priceCents"> & { skus?: Array<{ quantity: number; active: boolean }> }) {
  const discount = productDiscountPercent(product);
  const quantity = productQuantity(product);
  const signals: string[] = [];

  if (product.volume) signals.push(product.volume);
  if (discount > 0) signals.push("Desconto real");
  if (quantity > 0) signals.push("Pronta entrega");
  if (product.badges[0] && !signals.includes(product.badges[0])) signals.push(product.badges[0]);

  return signals.slice(0, 3);
}
