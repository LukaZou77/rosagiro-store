"use server";

import type { CustomerCatalogDownloadData } from "@/lib/admin-customer-catalog-core";
import { getCustomerCatalogPrintData } from "@/lib/admin-customer-catalog";
import { requireAdmin } from "@/lib/auth";
import { productQuantity } from "@/lib/product-conversion";

export async function getCustomerCatalogBrandDownloadData(brandId: string): Promise<CustomerCatalogDownloadData> {
  await requireAdmin();

  const catalog = await getCustomerCatalogPrintData({ brandId, priceStatus: "all" });
  if (!catalog) throw new Error("Marca não encontrada no catálogo ativo.");

  return {
    brand: { id: catalog.brand.id, name: catalog.brand.name },
    productCount: catalog.products.length,
    skuCount: catalog.skuCount,
    groups: catalog.groups.map((group) => ({
      id: group.id,
      slug: group.slug,
      label: group.label,
      products: group.products.map((product) => ({
        id: product.id,
        name: product.name,
        subcategory: product.subcategory,
        priceCents: product.priceCents,
        wholesalePackage: product.wholesalePackage,
        image: product.image,
        mpn: product.mpn,
        inStock: productQuantity(product) > 0,
        brandName: product.brand.name,
        categoryLabel: product.category.label,
        skus: product.skus.map((sku) => ({
          id: sku.id,
          name: sku.name,
          code: sku.code,
          image: sku.image,
          priceCents: sku.priceCents
        }))
      }))
    }))
  };
}
