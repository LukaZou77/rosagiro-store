import "server-only";

import type { Prisma } from "@/src/generated/prisma/client";
import { prisma } from "@/lib/db";
import { parseProductCsv, type ProductImportRow } from "@/lib/product-import-shared";

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
    gallery: [row.image],
    descriptionPt: row.descriptionPt,
    benefits: row.benefits.length ? row.benefits : ["Ajustar beneficios"],
    ingredients: row.ingredients.length ? row.ingredients : ["Ajustar ingredientes"],
    skinType: row.skinType,
    finish: row.finish,
    volume: row.volume,
    rating: row.rating,
    reviewCount: row.reviewCount,
    stockStatus: row.stock > 0 ? "Em estoque" : "Esgotado",
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
        note: "Ajustar descricao da categoria"
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
          logo: brandLogo(row.brand) || "BV",
          origin: "A ajustar",
          descriptionPt: "Descricao da marca a ajustar.",
          featured: false,
          categorySlugs: [category.slug]
        }
      });

  const existingProduct = await tx.product.findUnique({
    where: { slug: row.slug },
    select: { id: true }
  });

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

  await tx.inventory.upsert({
    where: { productId: product.id },
    update: { quantity: row.stock },
    create: { productId: product.id, quantity: row.stock }
  });

  return existingProduct ? "updated" : "created";
}

export async function importProductsFromCsv(csvText: string): Promise<ImportCounters> {
  const preview = parseProductCsv(csvText);
  if (!csvText.trim()) throw new ProductImportError("Envie um arquivo CSV antes de importar.");
  if (preview.missingHeaders.length) {
    throw new ProductImportError(`Campos obrigatorios ausentes: ${preview.missingHeaders.join(", ")}`);
  }
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
