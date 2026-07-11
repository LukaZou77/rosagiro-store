import "server-only";

import type { Prisma } from "@/src/generated/prisma/client";
import {
  CUSTOMER_CATALOG_PAGE_SIZE,
  type CustomerCatalogPriceStatus
} from "@/lib/admin-customer-catalog-core";
import { prisma } from "@/lib/db";

export type CustomerCatalogFilters = {
  query?: string;
  brandId?: string;
  categoryId?: string;
  priceStatus?: CustomerCatalogPriceStatus;
  page?: number;
};

const productSelect = {
  id: true,
  slug: true,
  name: true,
  subcategory: true,
  priceCents: true,
  baseBoxPriceCents: true,
  baseBoxPieces: true,
  wholesalePackage: true,
  image: true,
  mpn: true,
  inventory: { select: { quantity: true } },
  brand: { select: { id: true, slug: true, name: true } },
  category: { select: { id: true, slug: true, label: true } },
  skus: {
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      image: true,
      priceCents: true,
      quantity: true,
      active: true
    }
  }
} satisfies Prisma.ProductSelect;

export type CustomerCatalogProduct = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

const pricedCondition = {
  AND: [
    { baseBoxPriceCents: { not: null } },
    { baseBoxPieces: { not: null } },
    { wholesalePackage: { contains: "R$", mode: "insensitive" } }
  ]
} satisfies Prisma.ProductWhereInput;

function customerCatalogWhere(filters: CustomerCatalogFilters = {}): Prisma.ProductWhereInput {
  const query = filters.query?.trim() || "";
  const priceStatus = filters.priceStatus || "all";

  return {
    AND: [
      { active: true, deletedAt: null },
      filters.brandId && filters.brandId !== "all" ? { brandId: filters.brandId } : {},
      filters.categoryId && filters.categoryId !== "all" ? { categoryId: filters.categoryId } : {},
      priceStatus === "priced" ? pricedCondition : priceStatus === "consult" ? { NOT: pricedCondition } : {},
      query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { subcategory: { contains: query, mode: "insensitive" } },
              { mpn: { contains: query, mode: "insensitive" } },
              { gtin: { contains: query, mode: "insensitive" } },
              { brand: { name: { contains: query, mode: "insensitive" } } },
              { category: { label: { contains: query, mode: "insensitive" } } },
              {
                skus: {
                  some: {
                    active: true,
                    OR: [
                      { code: { contains: query, mode: "insensitive" } },
                      { name: { contains: query, mode: "insensitive" } }
                    ]
                  }
                }
              }
            ]
          }
        : {}
    ]
  };
}

export async function getCustomerCatalogOptions() {
  const activeWhere = { active: true, deletedAt: null } satisfies Prisma.ProductWhereInput;
  const [brands, categories] = await Promise.all([
    prisma.brand.findMany({
      where: { products: { some: activeWhere } },
      select: { id: true, name: true, _count: { select: { products: { where: activeWhere } } } },
      orderBy: { name: "asc" }
    }),
    prisma.category.findMany({
      where: { products: { some: activeWhere } },
      select: { id: true, label: true, _count: { select: { products: { where: activeWhere } } } },
      orderBy: { label: "asc" }
    })
  ]);

  return { brands, categories };
}

export async function getCustomerCatalogPreview(filters: CustomerCatalogFilters = {}) {
  const pageSize = CUSTOMER_CATALOG_PAGE_SIZE;
  const requestedPage = Math.max(1, filters.page || 1);
  const where = customerCatalogWhere(filters);
  const coverageWhere = customerCatalogWhere({ ...filters, priceStatus: "all" });
  const pricedWhere = { AND: [coverageWhere, pricedCondition] } satisfies Prisma.ProductWhereInput;

  const [total, skuCount, coverageTotal, pricedCount] = await Promise.all([
    prisma.product.count({ where }),
    prisma.productSku.count({ where: { active: true, product: where } }),
    prisma.product.count({ where: coverageWhere }),
    prisma.product.count({ where: pricedWhere })
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const products = await prisma.product.findMany({
    where,
    select: productSelect,
    orderBy: [{ brand: { name: "asc" } }, { category: { label: "asc" } }, { name: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize
  });

  return {
    products,
    total,
    skuCount,
    page,
    pageSize,
    totalPages,
    pricedCount,
    consultCount: Math.max(0, coverageTotal - pricedCount)
  };
}

export async function getCustomerCatalogPrintData(filters: CustomerCatalogFilters & { brandId: string }) {
  const brand = await prisma.brand.findFirst({
    where: {
      id: filters.brandId,
      products: { some: { active: true, deletedAt: null } }
    },
    select: { id: true, name: true, slug: true }
  });
  if (!brand) return null;

  const where = customerCatalogWhere(filters);
  const products = await prisma.product.findMany({
    where,
    select: productSelect,
    orderBy: [{ category: { label: "asc" } }, { name: "asc" }]
  });
  const category =
    filters.categoryId && filters.categoryId !== "all"
      ? await prisma.category.findUnique({
          where: { id: filters.categoryId },
          select: { id: true, label: true, slug: true }
        })
      : null;

  const groups = new Map<string, { id: string; slug: string; label: string; products: CustomerCatalogProduct[] }>();
  for (const product of products) {
    const existing = groups.get(product.category.id);
    if (existing) {
      existing.products.push(product);
    } else {
      groups.set(product.category.id, {
        id: product.category.id,
        slug: product.category.slug,
        label: product.category.label,
        products: [product]
      });
    }
  }

  return {
    brand,
    category,
    products,
    groups: Array.from(groups.values()),
    skuCount: products.reduce((sum, product) => sum + product.skus.length, 0)
  };
}
