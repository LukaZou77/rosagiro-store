import type { CatalogProduct } from "@/lib/catalog";

export type ProductStockTone = "ready" | "low" | "out";

export function productDiscountPercent(product: Pick<CatalogProduct, "compareAtPriceCents" | "priceCents">) {
  if (!product.compareAtPriceCents || product.compareAtPriceCents <= product.priceCents) return 0;
  return Math.round((1 - product.priceCents / product.compareAtPriceCents) * 100);
}

export function productQuantity(product: Pick<CatalogProduct, "inventory">) {
  return product.inventory?.quantity || 0;
}

export function productStockTone(product: Pick<CatalogProduct, "inventory">): ProductStockTone {
  const quantity = productQuantity(product);
  if (quantity <= 0) return "out";
  if (quantity <= 6) return "low";
  return "ready";
}

export function productStockLabel(product: Pick<CatalogProduct, "inventory">) {
  const quantity = productQuantity(product);
  if (quantity <= 0) return "Esgotado";
  if (quantity <= 6) return `Ultimas ${quantity} un.`;
  return `${quantity} un. pronta entrega`;
}

export function productShortStockLabel(product: Pick<CatalogProduct, "inventory">) {
  const quantity = productQuantity(product);
  if (quantity <= 0) return "Esgotado";
  if (quantity <= 6) return `${quantity} un.`;
  return `${quantity} un.`;
}

export function productHeroBadge(product: Pick<CatalogProduct, "badges" | "compareAtPriceCents" | "priceCents" | "inventory" | "stockStatus">) {
  const discount = productDiscountPercent(product);
  if (discount > 0) return `${discount}% OFF`;
  if (productStockTone(product) === "low") return "Ultimas unidades";
  return product.badges[0] || product.stockStatus;
}

export function productPurchaseSignals(product: Pick<CatalogProduct, "volume" | "badges" | "inventory" | "compareAtPriceCents" | "priceCents">) {
  const discount = productDiscountPercent(product);
  const quantity = productQuantity(product);
  const signals: string[] = [];

  if (product.volume) signals.push(product.volume);
  if (discount > 0) signals.push("Desconto real");
  if (quantity > 0) signals.push("Pronta entrega");
  if (product.badges[0] && !signals.includes(product.badges[0])) signals.push(product.badges[0]);

  return signals.slice(0, 3);
}
