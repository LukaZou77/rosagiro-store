import "server-only";

import type { Prisma } from "@/src/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  parseProductCsv,
  type ProductImportExistingProduct,
  type ProductImportRow
} from "@/lib/product-import-shared";

export class ProductImportError extends Error {
  constructor(message: string) {
    super(message);
  }
}

type ImportCounters = {
  created: number;
  updated: number;
  stockUpdated: number;
};

export async function getProductImportExistingProducts(slugs?: string[]): Promise<ProductImportExistingProduct[]> {
  const products = await prisma.product.findMany({
    where: slugs?.length ? { slug: { in: slugs } } : undefined,
    include: { brand: true, category: true, inventory: true, skus: { select: { active: true } } }
  });

  return products.map((product) => ({
    slug: product.slug,
    name: product.name,
    priceCents: product.priceCents,
    stock: product.inventory?.quantity || 0,
    hasActiveSkus: product.skus.some((sku) => sku.active),
    active: product.active,
    deletedAt: product.deletedAt,
    brand: product.brand.name,
    category: product.category.label,
    weightGrams: product.weightGrams
  }));
}

function brandLogo(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function productData(row: ProductImportRow, brandId: string, categoryId: string) {
  return {
    brandId,
    categoryId,
    name: row.name,
    subcategory: row.subcategory,
    priceCents: row.priceCents,
    compareAtPriceCents: row.compareAtPriceCents,
    image: row.image,
    gallery: row.gallery,
    descriptionPt: row.descriptionPt,
    benefits: row.benefits,
    ingredients: row.ingredients,
    skinType: row.skinType,
    finish: row.finish,
    volume: row.volume,
    weightGrams: row.weightGrams,
    suggestedQuantity: row.suggestedQuantity,
    kitRecommendation: row.kitRecommendation,
    wholesalePackage: row.wholesalePackage,
    validityNote: row.validityNote,
    purchaseNote: row.purchaseNote,
    rating: row.rating,
    reviewCount: row.reviewCount,
    stockStatus: row.stock > 0 ? "Em estoque" : "Sem estoque",
    badges: row.badges,
    active: row.active
  };
}

async function importRow(tx: Prisma.TransactionClient, row: ProductImportRow, index: number) {
  const category =
    (await tx.category.findUnique({ where: { slug: row.categorySlug } })) ||
    (await tx.category.create({
      data: {
        slug: row.categorySlug,
        label: row.category,
        note: "Ajustar descrição da categoria"
      }
    }));

  const existingBrand = await tx.brand.findFirst({
    where: {
      OR: [{ slug: row.brandSlug }, { name: row.brand }]
    }
  });

  const brand = existingBrand
    ? await tx.brand.update({
        where: { id: existingBrand.id },
        data: {
          categorySlugs: Array.from(new Set([...existingBrand.categorySlugs, category.slug]))
        }
      })
    : await tx.brand.create({
        data: {
          slug: row.brandSlug,
          name: row.brand,
          logo: brandLogo(row.brand) || "RG",
          origin: "",
          descriptionPt: "Descrição da marca a ajustar.",
          featured: false,
          categorySlugs: [category.slug]
        }
      });

  const existingProduct = await tx.product.findUnique({
    where: { slug: row.slug },
    select: { id: true, deletedAt: true, skus: { select: { active: true, quantity: true } } }
  });
  if (existingProduct?.deletedAt) {
    throw new ProductImportError(`O produto ${row.slug} está na lixeira. Restaure antes de importar.`);
  }

  const data = productData(row, brand.id, category.id);
  const product = await tx.product.upsert({
    where: { slug: row.slug },
    update: data,
    create: {
      slug: row.slug,
      featuredRank: 1000 + index,
      ...data
    }
  });

  const activeSkuStock = existingProduct?.skus.some((sku) => sku.active)
    ? existingProduct.skus.reduce((total, sku) => (sku.active ? total + Math.max(0, sku.quantity) : total), 0)
    : null;

  await tx.inventory.upsert({
    where: { productId: product.id },
    update: { quantity: activeSkuStock ?? row.stock },
    create: { productId: product.id, quantity: activeSkuStock ?? row.stock }
  });

  return existingProduct ? "updated" : "created";
}

export async function importProductsFromCsv(csvText: string): Promise<ImportCounters> {
  const initialPreview = parseProductCsv(csvText);
  if (!csvText.trim()) throw new ProductImportError("Envie um arquivo CSV antes de importar.");
  if (initialPreview.missingHeaders.length) {
    throw new ProductImportError(`Campos obrigatorios ausentes: ${initialPreview.missingHeaders.join(", ")}`);
  }

  const existingProducts = await getProductImportExistingProducts(initialPreview.rows.map((row) => row.slug).filter(Boolean));
  const preview = parseProductCsv(csvText, { existingProducts });
  if (preview.errorCount) {
    throw new ProductImportError("Corrija os erros da pre-visualizacao antes de importar.");
  }

  return prisma.$transaction(async (tx) => {
    const counters: ImportCounters = { created: 0, updated: 0, stockUpdated: 0 };

    for (const [index, row] of preview.rows.entries()) {
      const outcome = await importRow(tx, row, index);
      counters.stockUpdated += 1;
      if (outcome === "created") counters.created += 1;
      else counters.updated += 1;
    }

    return counters;
  });
}
