import { siteConfig } from "@/lib/site-config";

export type CartCompletionProduct = {
  slug: string;
  name: string;
  image: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  badges: string[];
  active: boolean;
  rating?: number;
  reviewCount?: number;
  brand: { name: string };
  category: { slug: string; label?: string };
  inventory: { quantity: number } | null;
  skus?: Array<{ quantity: number; active: boolean }>;
};

export type CartCompletionLine = {
  slug: string;
  skuId?: string;
  quantity: number;
};

export type CartCompletionRecommendation = {
  slug: string;
  name: string;
  brandName: string;
  image: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  stockQuantity: number;
  hasSkuChoices: boolean;
  reason: string;
};

type RecommendationOptions = {
  currentCategorySlug?: string;
  excludeSlug?: string;
  limit?: number;
  minimumOrderCents?: number;
};

function discountPercent(product: Pick<CartCompletionProduct, "compareAtPriceCents" | "priceCents">) {
  if (!product.compareAtPriceCents || product.compareAtPriceCents <= product.priceCents) return 0;
  return Math.round((1 - product.priceCents / product.compareAtPriceCents) * 100);
}

function productStock(product: Pick<CartCompletionProduct, "inventory"> & { skus?: Array<{ quantity: number; active: boolean }> }) {
  if ("skus" in product && product.skus?.some((sku) => sku.active)) {
    return product.skus.reduce((total, sku) => (sku.active ? total + Math.max(0, sku.quantity) : total), 0);
  }
  return product.inventory?.quantity || 0;
}

function recommendationReason(product: CartCompletionProduct, remainingCents: number, preferredCategories: Set<string>) {
  const discount = discountPercent(product);
  if (remainingCents > 0 && product.priceCents <= remainingCents) return "Ajuda a fechar o mínimo";
  if (discount > 0) return "Desconto real para completar";
  if (preferredCategories.has(product.category.slug)) return "Combina com sua lista";
  if (/mais vendido|favorito|oferta|novo/i.test(product.badges.join(" "))) return "Boa saida para reposicao";
  return "Pronta entrega para adicionar";
}

export function getCartCompletionRecommendations(
  products: CartCompletionProduct[],
  cart: CartCompletionLine[],
  options: RecommendationOptions = {}
): CartCompletionRecommendation[] {
  const minimumOrderCents = options.minimumOrderCents ?? siteConfig.wholesale.minimumOrderCents;
  const limit = options.limit ?? 4;
  const cartQuantityBySlug = new Map(cart.map((item) => [item.slug, Math.max(0, Math.floor(item.quantity || 0))]));
  const productBySlug = new Map(products.map((product) => [product.slug, product]));
  const cartSubtotal = cart.reduce((sum, item) => {
    const product = productBySlug.get(item.slug);
    return product ? sum + product.priceCents * Math.max(0, Math.floor(item.quantity || 0)) : sum;
  }, 0);
  const remainingCents = Math.max(0, minimumOrderCents - cartSubtotal);
  const preferredCategories = new Set<string>();

  if (options.currentCategorySlug) preferredCategories.add(options.currentCategorySlug);
  for (const item of cart) {
    const product = productBySlug.get(item.slug);
    if (product?.category.slug) preferredCategories.add(product.category.slug);
  }

  return products
    .filter((product) => {
      if (!product.active || product.slug === options.excludeSlug) return false;
      if (cartQuantityBySlug.has(product.slug)) return false;
      return productStock(product) > 0;
    })
    .map((product) => {
      const discount = discountPercent(product);
      const stock = productStock(product);
      const sameCategory = preferredCategories.has(product.category.slug);
      const badgeBoost = /mais vendido|favorito|oferta|novo/i.test(product.badges.join(" ")) ? 1 : 0;
      const fitsGap = remainingCents > 0 && product.priceCents <= remainingCents;
      const nearGap = remainingCents > 0 ? Math.max(0, 30 - Math.floor(Math.abs(product.priceCents - remainingCents) / 1000)) : 0;
      const score =
        (fitsGap ? 90 : 0) +
        nearGap +
        (sameCategory ? 32 : 0) +
        (discount > 0 ? 28 : 0) +
        (badgeBoost ? 18 : 0) +
        Math.min(stock, 18) +
        Math.min(product.reviewCount || 0, 20) / 4;

      return {
        product,
        score,
        stock
      };
    })
    .sort((a, b) => b.score - a.score || a.product.priceCents - b.product.priceCents || a.product.name.localeCompare(b.product.name))
    .slice(0, limit)
    .map(({ product, stock }) => ({
      slug: product.slug,
      name: product.name,
      brandName: product.brand.name,
      image: product.image,
      priceCents: product.priceCents,
      compareAtPriceCents: product.compareAtPriceCents,
      stockQuantity: stock,
      hasSkuChoices: Boolean(product.skus?.some((sku) => sku.active)),
      reason: recommendationReason(product, remainingCents, preferredCategories)
    }));
}
