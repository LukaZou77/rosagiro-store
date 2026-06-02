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
    stock: product.inventory?.quantity || 0,
    active: product.active,
    image: product.image,
    gallery: pipeListValue(product.gallery),
    descriptionPt: product.descriptionPt,
    compareAtPrice: formatImportMoney(product.compareAtPriceCents),
    benefits: pipeListValue(product.benefits),
    ingredients: pipeListValue(product.ingredients),
    badges: pipeListValue(product.badges),
    skinType: product.skinType,
    finish: product.finish,
    volume: product.volume,
    weightGrams: product.weightGrams,
    rating: String(product.rating).replace(".", ","),
    reviewCount: product.reviewCount
  }));

  return recordsToProductCsv(records);
}
