"use server";

import type {
  CustomerCatalogCompleteDownloadData,
  CustomerCatalogDownloadData,
  CustomerCatalogDownloadProduct
} from "@/lib/admin-customer-catalog-core";
import {
  getCustomerCatalogCompletePrintData,
  getCustomerCatalogPrintData,
  type CustomerCatalogProduct
} from "@/lib/admin-customer-catalog";
import { requireAdmin } from "@/lib/auth";
import { productQuantity } from "@/lib/product-conversion";

function toCustomerCatalogDownloadProduct(product: CustomerCatalogProduct): CustomerCatalogDownloadProduct {
  return {
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
  };
}

function toCustomerCatalogDownloadData(catalog: {
  brand: { id: string; name: string };
  products: CustomerCatalogProduct[];
  groups: Array<{ id: string; slug: string; label: string; products: CustomerCatalogProduct[] }>;
  skuCount: number;
}): CustomerCatalogDownloadData {
  return {
    brand: { id: catalog.brand.id, name: catalog.brand.name },
    productCount: catalog.products.length,
    skuCount: catalog.skuCount,
    groups: catalog.groups.map((group) => ({
      id: group.id,
      slug: group.slug,
      label: group.label,
      products: group.products.map(toCustomerCatalogDownloadProduct)
    }))
  };
}

export async function getCustomerCatalogBrandDownloadData(brandId: string): Promise<CustomerCatalogDownloadData> {
  await requireAdmin();

  const catalog = await getCustomerCatalogPrintData({ brandId, priceStatus: "all" });
  if (!catalog) throw new Error("Marca não encontrada no catálogo ativo.");

  return toCustomerCatalogDownloadData(catalog);
}

export async function getCustomerCatalogCompleteDownloadData(): Promise<CustomerCatalogCompleteDownloadData> {
  await requireAdmin();

  const brands = (await getCustomerCatalogCompletePrintData()).map(toCustomerCatalogDownloadData);
  return {
    brands,
    productCount: brands.reduce((sum, brand) => sum + brand.productCount, 0),
    skuCount: brands.reduce((sum, brand) => sum + brand.skuCount, 0)
  };
}
