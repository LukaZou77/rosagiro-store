import type { CatalogProduct } from "@/lib/catalog";

export type ProductStockTone = "ready" | "low" | "out";

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

export function productHeroBadge(product: Pick<CatalogProduct, "badges" | "inventory" | "stockStatus"> & { skus?: Array<{ quantity: number; active: boolean }> }) {
  if (productStockTone(product) === "out") return "Sem estoque";
  return product.badges.find((badge) => !/^em estoque$/i.test(badge.trim())) || "";
}

export function productPurchaseSignals(product: Pick<CatalogProduct, "volume" | "badges" | "inventory"> & { skus?: Array<{ quantity: number; active: boolean }> }) {
  const signals: string[] = [];

  if (product.volume) signals.push(product.volume);
  for (const badge of product.badges) {
    if (/^em estoque$/i.test(badge.trim())) continue;
    if (!signals.includes(badge)) signals.push(badge);
  }

  return signals.slice(0, 3);
}
