import type { CatalogProduct } from "@/lib/catalog";
import { productWholesaleOrderQuantityLimit, productWholesalePackagePieces, productWholesalePackagePriceCents, productWholesaleStockQuantity } from "@/lib/product-wholesale";
import { INVENTORY_MANAGEMENT_ENABLED } from "@/lib/inventory-policy";
import { isProductStockConsultationRequired } from "@/lib/source-catalog-product";

export type ProductStockTone = "ready" | "low" | "out" | "consultation";

type StockSource = Pick<CatalogProduct, "inventory"> & {
  stockStatus?: string | null;
  priceCents?: number;
  baseBoxPieces?: number | null;
  baseBoxPriceCents?: number | null;
  wholesalePackage?: string | null;
  descriptionPt?: string | null;
  skus?: Array<{ quantity: number; active: boolean }>;
};

export function productQuantity(product: StockSource) {
  return productWholesaleStockQuantity(product);
}

export function productOrderQuantityLimit(product: StockSource) {
  return productWholesaleOrderQuantityLimit(product);
}

export function productStockTone(product: StockSource): ProductStockTone {
  if (!INVENTORY_MANAGEMENT_ENABLED) {
    const pieces = productWholesalePackagePieces(product);
    const price = productWholesalePackagePriceCents({ ...product, priceCents: product.priceCents || 0 });
    return pieces && price ? "ready" : "consultation";
  }
  if (isProductStockConsultationRequired(product)) return "consultation";
  const quantity = productQuantity(product);
  if (quantity <= 0) return "out";
  return "ready";
}

export function productStockLabel(product: StockSource) {
  if (!INVENTORY_MANAGEMENT_ENABLED) {
    return productStockTone(product) === "ready" ? "Disponível para pedido" : "Embalagem ou preço sob consulta";
  }
  if (isProductStockConsultationRequired(product)) return "Estoque sob consulta";
  const quantity = productQuantity(product);
  if (quantity <= 0) return "Sem estoque";
  return "Em estoque";
}

export function productShortStockLabel(product: StockSource) {
  if (!INVENTORY_MANAGEMENT_ENABLED) {
    return productStockTone(product) === "ready" ? "Disponível" : "Embalagem sob consulta";
  }
  if (isProductStockConsultationRequired(product)) return "Sob consulta";
  return productStockLabel(product);
}

export function productHeroBadge(product: Pick<CatalogProduct, "badges" | "inventory" | "stockStatus"> & { skus?: Array<{ quantity: number; active: boolean }> }) {
  if (isProductStockConsultationRequired(product)) return "Sob consulta";
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
