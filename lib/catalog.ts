import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import type { Prisma } from "@/src/generated/prisma/client";
import { STOREFRONT_CATALOG_CACHE_TAG } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { BODY_AREA_CATEGORY_ORDER } from "@/lib/category-taxonomy";
import { customerDisplayText } from "@/lib/display-text";

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  subcategory: string;
  priceCents: number;
  baseBoxPriceCents: number | null;
  baseBoxPieces: number | null;
  compareAtPriceCents: number | null;
  weightGrams: number | null;
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
  gtin: string | null;
  mpn: string | null;
  rating: number;
  reviewCount: number;
  stockStatus: string;
  badges: string[];
  active: boolean;
  brand: { slug: string; name: string; logo: string; origin: string; descriptionPt: string; featured: boolean };
  category: { slug: string; label: string; note: string };
  inventory: { quantity: number } | null;
  skus: Array<{ id: string; name: string; code: string; image: string | null; priceCents: number | null; quantity: number; active: boolean; sortOrder: number }>;
};

export const CATALOG_PAGE_SIZE = 24;

const productInclude = {
  brand: true,
  category: true,
  inventory: true,
  skus: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }
} satisfies Prisma.ProductInclude;

const productCardSelect = {
  id: true,
  slug: true,
  name: true,
  subcategory: true,
  priceCents: true,
  baseBoxPriceCents: true,
  baseBoxPieces: true,
  suggestedQuantity: true,
  kitRecommendation: true,
  wholesalePackage: true,
  validityNote: true,
  purchaseNote: true,
  image: true,
  volume: true,
  rating: true,
  reviewCount: true,
  stockStatus: true,
  badges: true,
  active: true,
  brand: { select: { slug: true, name: true } },
  category: { select: { slug: true, label: true } },
  inventory: { select: { quantity: true } },
  skus: {
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      image: true,
      priceCents: true,
      quantity: true,
      active: true,
      sortOrder: true
    }
  }
} satisfies Prisma.ProductSelect;

export type CatalogCardProduct = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

type ProductQueryOptions = {
  categorySlug?: string;
  brandName?: string;
  query?: string;
  sort?: string;
  stockFilter?: string;
  activeOnly?: boolean;
};

type ProductListOptions = ProductQueryOptions & {
  take?: number;
  skip?: number;
};

function productWhere(options: ProductQueryOptions = {}): Prisma.ProductWhereInput {
  const { categorySlug, brandName, query, stockFilter = "all", activeOnly = true } = options;

  return {
    deletedAt: null,
    active: activeOnly ? true : undefined,
    category: categorySlug && categorySlug !== "all" ? { slug: categorySlug } : undefined,
    brand: brandName && brandName !== "all" ? { name: brandName } : undefined,
    inventory:
      stockFilter === "ready"
        ? { quantity: { gt: 0 } }
        : stockFilter === "out"
          ? { quantity: 0 }
          : undefined,
    OR: query
      ? [
          { name: { contains: query, mode: "insensitive" } },
          { subcategory: { contains: query, mode: "insensitive" } },
          { descriptionPt: { contains: query, mode: "insensitive" } },
          { brand: { name: { contains: query, mode: "insensitive" } } }
        ]
      : undefined
  };
}

function productOrderBy(sort = "featured"): Prisma.ProductOrderByWithRelationInput {
  return sort === "price-asc"
    ? { priceCents: "asc" }
    : sort === "price-desc"
      ? { priceCents: "desc" }
      : sort === "name-asc"
        ? { name: "asc" }
        : sort === "name-desc"
          ? { name: "desc" }
          : { featuredRank: "asc" };
}

function withProductDisplayText(product: CatalogProduct): CatalogProduct {
  return {
    ...product,
    subcategory: customerDisplayText(product.subcategory),
    badges: product.badges.map(customerDisplayText),
    category: {
      ...product.category,
      label: customerDisplayText(product.category.label),
      note: customerDisplayText(product.category.note)
    }
  };
}

function withProductCardDisplayText(product: CatalogCardProduct): CatalogCardProduct {
  return {
    ...product,
    subcategory: customerDisplayText(product.subcategory),
    badges: product.badges.map(customerDisplayText),
    category: {
      ...product.category,
      label: customerDisplayText(product.category.label)
    }
  };
}

const getCategoriesCached = unstable_cache(async function getCategories() {
  const categories = await prisma.category.findMany();
  return categories
    .sort((a, b) => {
      const aIndex = BODY_AREA_CATEGORY_ORDER.indexOf(a.slug);
      const bIndex = BODY_AREA_CATEGORY_ORDER.indexOf(b.slug);
      if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
      if (aIndex >= 0) return -1;
      if (bIndex >= 0) return 1;
      return a.label.localeCompare(b.label, "pt-BR");
    })
    .map((category) => ({
      ...category,
      label: customerDisplayText(category.label),
      note: customerDisplayText(category.note)
    }));
}, ["storefront-categories"], {
  revalidate: 3600,
  tags: [STOREFRONT_CATALOG_CACHE_TAG]
});

export const getCategories = cache(getCategoriesCached);

export async function getFeaturedBrands() {
  const brands = await prisma.brand.findMany({
    where: {
      featured: true,
      products: {
        some: productWhere()
      }
    },
    orderBy: { name: "asc" }
  });

  if (brands.length) return brands;
  return (await getActiveBrandSummaries()).slice(0, 8);
}

export async function getActiveBrandSummaries() {
  const brands = await prisma.brand.findMany({
    where: {
      products: {
        some: productWhere()
      }
    },
    select: {
      slug: true,
      name: true,
      logo: true,
      descriptionPt: true,
      featured: true,
      _count: {
        select: {
          products: {
            where: productWhere()
          }
        }
      }
    },
    orderBy: [{ featured: "desc" }, { name: "asc" }]
  });

  return brands
    .map((brand) => ({
      slug: brand.slug,
      name: brand.name,
      logo: brand.logo,
      descriptionPt: brand.descriptionPt,
      featured: brand.featured,
      productCount: brand._count.products
    }))
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (a.productCount !== b.productCount) return b.productCount - a.productCount;
      return a.name.localeCompare(b.name, "pt-BR");
    });
}

const getActiveBrandSummaryCached = unstable_cache(async function getActiveBrandSummary(slug: string) {
  const brand = await prisma.brand.findFirst({
    where: {
      slug,
      products: {
        some: productWhere()
      }
    },
    select: {
      slug: true,
      name: true,
      logo: true,
      origin: true,
      descriptionPt: true,
      featured: true,
      _count: {
        select: {
          products: {
            where: productWhere()
          }
        }
      }
    }
  });

  if (!brand) return null;
  return {
    slug: brand.slug,
    name: brand.name,
    logo: brand.logo,
    origin: brand.origin,
    descriptionPt: brand.descriptionPt,
    featured: brand.featured,
    productCount: brand._count.products
  };
}, ["active-brand-summary"], {
  revalidate: 300,
  tags: [STOREFRONT_CATALOG_CACHE_TAG]
});

export const getActiveBrandSummary = cache(getActiveBrandSummaryCached);

export async function getProducts(options: ProductListOptions = {}) {
  const { sort = "featured", take, skip } = options;
  const products = await prisma.product.findMany({
    where: productWhere(options),
    select: productCardSelect,
    orderBy: productOrderBy(sort),
    take,
    skip
  });

  return products.map(withProductCardDisplayText);
}

export async function getProductCount(options: ProductQueryOptions = {}) {
  return prisma.product.count({ where: productWhere(options) });
}

export async function getProductPage(options: ProductQueryOptions & { page?: number; pageSize?: number } = {}) {
  const pageSize = Math.max(1, Math.min(96, Math.floor(options.pageSize || CATALOG_PAGE_SIZE)));
  const requestedPage = Math.max(1, Math.floor(options.page || 1));
  const where = productWhere(options);
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: productCardSelect,
      orderBy: productOrderBy(options.sort),
      take: pageSize,
      skip: (requestedPage - 1) * pageSize
    })
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  return {
    products: products.map(withProductCardDisplayText),
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}

export async function getProductAvailabilityCounts(options: Omit<ProductQueryOptions, "stockFilter"> = {}) {
  const [ready, out] = await Promise.all([
    prisma.product.count({ where: productWhere({ ...options, stockFilter: "ready" }) }),
    prisma.product.count({ where: productWhere({ ...options, stockFilter: "out" }) })
  ]);

  return { ready, out };
}

export async function getBrandOptionsForCategory(categorySlug?: string) {
  const brands = await prisma.brand.findMany({
    where: {
      products: {
        some: productWhere({ categorySlug })
      }
    },
    select: { name: true },
    orderBy: { name: "asc" }
  });

  return brands.map((brand) => brand.name);
}

const getRecommendationPoolCached = unstable_cache(async function getRecommendationPool(categorySlug?: string) {
  const products = await prisma.product.findMany({
    where: {
      ...productWhere({ categorySlug }),
      OR: [{ inventory: { quantity: { gt: 0 } } }, { skus: { some: { active: true, quantity: { gt: 0 } } } }]
    },
    select: productCardSelect,
    orderBy: { featuredRank: "asc" },
    take: 64
  });

  return products.map(withProductCardDisplayText);
}, ["recommendation-product-pool"], {
  revalidate: 300,
  tags: [STOREFRONT_CATALOG_CACHE_TAG]
});

export async function getRecommendationProducts(options: {
  categorySlug?: string;
  excludeSlug?: string;
  take?: number;
} = {}) {
  const take = Math.max(4, Math.min(64, options.take || 24));
  const products = await getRecommendationPoolCached(options.categorySlug);

  return products.filter((product) => product.slug !== options.excludeSlug).slice(0, take);
}

export async function getPromotionCollections() {
  const stockWhere = {
    ...productWhere(),
    OR: [{ inventory: { quantity: { gt: 0 } } }, { skus: { some: { active: true, quantity: { gt: 0 } } } }]
  } satisfies Prisma.ProductWhereInput;
  const [readyStockCount, lowPriceProducts, stockReadyProducts, products] = await Promise.all([
    prisma.product.count({ where: stockWhere }),
    prisma.product.findMany({
      where: stockWhere,
      select: productCardSelect,
      orderBy: { priceCents: "asc" },
      take: 4
    }),
    prisma.product.findMany({
      where: stockWhere,
      select: productCardSelect,
      orderBy: [{ featuredRank: "asc" }, { updatedAt: "desc" }],
      take: 4
    }),
    prisma.product.findMany({
      where: stockWhere,
      select: productCardSelect,
      orderBy: { featuredRank: "asc" },
      take: 32
    })
  ]);
  const displayProducts = products.map(withProductCardDisplayText);
  const withStock = (product: CatalogCardProduct) => (product.inventory?.quantity || 0) > 0;
  const hotProducts = [...displayProducts]
    .filter(withStock)
    .sort((a, b) => {
      const aBadge = a.badges.some((badge) => /mais vendido|favorito|destaque/i.test(badge)) ? 1 : 0;
      const bBadge = b.badges.some((badge) => /mais vendido|favorito|destaque/i.test(badge)) ? 1 : 0;
      return bBadge - aBadge || b.reviewCount - a.reviewCount || b.rating - a.rating;
    })
    .slice(0, 4);

  return {
    products: displayProducts,
    lowPriceProducts: lowPriceProducts.map(withProductCardDisplayText),
    hotProducts,
    stockReadyProducts: stockReadyProducts.map(withProductCardDisplayText),
    readyStockCount
  };
}

const getProductCached = unstable_cache(async function getProduct(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, active: true, deletedAt: null },
    include: productInclude
  });

  return product ? withProductDisplayText(product) : null;
}, ["storefront-product"], {
  revalidate: 300,
  tags: [STOREFRONT_CATALOG_CACHE_TAG]
});

export const getProduct = cache(getProductCached);

export async function getRelatedProducts(categorySlug: string, currentSlug: string) {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      deletedAt: null,
      category: { slug: categorySlug },
      slug: { not: currentSlug }
    },
    select: productCardSelect,
    take: 4,
    orderBy: { featuredRank: "asc" }
  });

  return products.map(withProductCardDisplayText);
}
