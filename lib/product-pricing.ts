export type ProductPriceSource = {
  priceCents: number;
  skus?: Array<{ priceCents?: number | null; active?: boolean }>;
};

export type SkuPriceSource = {
  priceCents?: number | null;
};

export function effectiveSkuPriceCents(product: Pick<ProductPriceSource, "priceCents">, sku?: SkuPriceSource | null) {
  return sku?.priceCents && sku.priceCents > 0 ? sku.priceCents : product.priceCents;
}

export function lowestEffectivePriceCents(product: ProductPriceSource) {
  const skuPrices = (product.skus || [])
    .filter((sku) => sku.active !== false)
    .map((sku) => effectiveSkuPriceCents(product, sku));
  return skuPrices.length ? Math.min(...skuPrices) : product.priceCents;
}

export function hasSkuPriceRange(product: ProductPriceSource) {
  const skuPrices = (product.skus || []).filter((sku) => sku.active !== false).map((sku) => effectiveSkuPriceCents(product, sku));
  const prices = new Set(skuPrices.length ? skuPrices : [product.priceCents]);
  return prices.size > 1;
}
