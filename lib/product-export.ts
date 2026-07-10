import "server-only";

import { prisma } from "@/lib/db";
import {
  formatImportMoney,
  pipeListValue,
  recordsToProductCsv,
  type ProductImportCsvRecord
} from "@/lib/product-import-shared";

export async function currentProductsCsv() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: { brand: true, category: true, inventory: true },
    orderBy: [{ featuredRank: "asc" }, { updatedAt: "desc" }]
  });

  const records: ProductImportCsvRecord[] = products.map((product) => ({
    slug: product.slug,
    name: product.name,
    brand: product.brand.name,
    category: product.category.slug,
    subcategory: product.subcategory,
    price: formatImportMoney(product.priceCents),
    stock: (product.inventory?.quantity || 0) > 0 ? 1 : 0,
    active: product.active,
    image: product.image,
    gallery: pipeListValue(product.gallery),
    descriptionPt: product.descriptionPt,
    benefits: pipeListValue(product.benefits),
    ingredients: pipeListValue(product.ingredients),
    badges: pipeListValue(product.badges),
    skinType: product.skinType,
    finish: product.finish,
    volume: product.volume,
    gtin: product.gtin,
    mpn: product.mpn,
    weightGrams: product.weightGrams,
    suggestedQuantity: product.suggestedQuantity,
    kitRecommendation: product.kitRecommendation,
    wholesalePackage: product.wholesalePackage,
    validityNote: product.validityNote,
    purchaseNote: product.purchaseNote,
    rating: String(product.rating).replace(".", ","),
    reviewCount: product.reviewCount
  }));

  return recordsToProductCsv(records);
}
