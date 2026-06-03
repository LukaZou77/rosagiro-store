import "server-only";

import { prisma } from "@/lib/db";

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  subcategory: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  weightGrams: number;
  suggestedQuantity: number | null;
  kitRecommendation: string | null;
  wholesalePackage: string | null;
  validityNote: string | null;
  purchaseNote: string | null;
  image: string;
  gallery: string[];
  descriptionPt: string;
  benefits: string[];
  ingredients: string[];
  skinType: string;
  finish: string;
  volume: string;
  rating: number;
  reviewCount: number;
  stockStatus: string;
  badges: string[];
  active: boolean;
  brand: { slug: string; name: string; logo: string; origin: string; descriptionPt: string; featured: boolean };
  category: { slug: string; label: string; note: string };
  inventory: { quantity: number } | null;
};

const productInclude = {
  brand: true,
  category: true,
  inventory: true
} as const;

export async function getCategories() {
  const order = ["skincare", "makeup", "fragrance", "body", "hair", "tools"];
  const categories = await prisma.category.findMany();
  return categories.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
}

export async function getFeaturedBrands() {
  return prisma.brand.findMany({
    where: { featured: true },
    orderBy: { name: "asc" }
  });
}

export async function getProducts(options: {
  categorySlug?: string;
  brandName?: string;
  query?: string;
  sort?: string;
  activeOnly?: boolean;
} = {}) {
  const { categorySlug, brandName, query, sort = "featured", activeOnly = true } = options;
  const products = await prisma.product.findMany({
    where: {
      active: activeOnly ? true : undefined,
      category: categorySlug && categorySlug !== "all" ? { slug: categorySlug } : undefined,
      brand: brandName && brandName !== "all" ? { name: brandName } : undefined,
      OR: query
        ? [
            { name: { contains: query, mode: "insensitive" } },
            { subcategory: { contains: query, mode: "insensitive" } },
            { descriptionPt: { contains: query, mode: "insensitive" } },
            { brand: { name: { contains: query, mode: "insensitive" } } }
          ]
        : undefined
    },
    include: productInclude,
    orderBy:
      sort === "price-asc"
        ? { priceCents: "asc" }
        : sort === "price-desc"
          ? { priceCents: "desc" }
          : sort === "name-asc"
            ? { name: "asc" }
            : sort === "name-desc"
              ? { name: "desc" }
              : sort === "rating"
                ? { rating: "desc" }
                : { featuredRank: "asc" }
  });

  return products as CatalogProduct[];
}

export function discountPercent(product: CatalogProduct) {
  if (!product.compareAtPriceCents || product.compareAtPriceCents <= product.priceCents) return 0;
  return Math.round((1 - product.priceCents / product.compareAtPriceCents) * 100);
}

export async function getPromotionCollections() {
  const products = await getProducts();
  const withStock = (product: CatalogProduct) => (product.inventory?.quantity || 0) > 0;
  const dealProducts = products
    .filter((product) => withStock(product) && discountPercent(product) > 0)
    .sort((a, b) => discountPercent(b) - discountPercent(a));
  const lowPriceProducts = [...products].filter(withStock).sort((a, b) => a.priceCents - b.priceCents).slice(0, 4);
  const hotProducts = [...products]
    .filter(withStock)
    .sort((a, b) => {
      const aBadge = a.badges.some((badge) => /mais vendido|favorito|oferta/i.test(badge)) ? 1 : 0;
      const bBadge = b.badges.some((badge) => /mais vendido|favorito|oferta/i.test(badge)) ? 1 : 0;
      return bBadge - aBadge || b.reviewCount - a.reviewCount || b.rating - a.rating;
    })
    .slice(0, 4);
  const stockReadyProducts = [...products]
    .filter(withStock)
    .sort((a, b) => (b.inventory?.quantity || 0) - (a.inventory?.quantity || 0))
    .slice(0, 4);

  return {
    products,
    dealProducts,
    lowPriceProducts,
    hotProducts,
    stockReadyProducts
  };
}

export async function getProduct(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: productInclude
  });

  return product as CatalogProduct | null;
}

export async function getRelatedProducts(categorySlug: string, currentSlug: string) {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      category: { slug: categorySlug },
      slug: { not: currentSlug }
    },
    include: productInclude,
    take: 4,
    orderBy: { featuredRank: "asc" }
  });

  return products as CatalogProduct[];
}
