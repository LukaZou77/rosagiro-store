import assert from "node:assert/strict";
import test from "node:test";
import type { CustomerCatalogDownloadData } from "./admin-customer-catalog-core";
import {
  buildCustomerCatalogCompletePdfDefinition,
  buildCustomerCatalogPdfDefinition,
  collectCustomerCatalogCompleteImageSources,
  collectCustomerCatalogImageSources
} from "./admin-customer-catalog-pdf";
import type { CustomerCatalogCompleteDownloadData } from "./admin-customer-catalog-core";

const catalog: CustomerCatalogDownloadData = {
  brand: { id: "ruby", name: "Ruby Rose" },
  productCount: 1,
  skuCount: 2,
  groups: [
    {
      id: "lips",
      slug: "labios",
      label: "Lábios",
      products: [
        {
          id: "product",
          name: "Batom Duo Ruby Rose HB-L6203",
          subcategory: "Batom líquido",
          priceCents: 975,
          wholesalePackage: "Caixa com 36 unidades: R$ 351,00.",
          image: "/product.jpg",
          mpn: "HB-L6203",
          inStock: true,
          brandName: "Ruby Rose",
          categoryLabel: "Lábios",
          skus: [
            { id: "one", name: "Cor 01", code: "HB-L6203-01", image: "/sku-01.jpg", priceCents: 975 },
            { id: "two", name: "Cor 02", code: "HB-L6203-02", image: "/sku-02.jpg", priceCents: 975 }
          ]
        }
      ]
    }
  ]
};

test("collects the real header, product and SKU image sources once", () => {
  assert.deepEqual(collectCustomerCatalogImageSources(catalog, "/brand/header.webp"), [
    "/brand/header.webp",
    "/product.jpg",
    "/sku-01.jpg",
    "/sku-02.jpg"
  ]);
});

test("builds searchable stock and national-shipping text without quantity or update labels", () => {
  const definition = buildCustomerCatalogPdfDefinition(catalog, {
    headerImage: "/brand/header.webp",
    imageData: new Map(),
    minimumOrderCents: 30000,
    whatsapp: "+55 11 97079-2390"
  });
  const serialized = JSON.stringify(definition);

  assert.match(serialized, /Estoque disponível/);
  assert.match(serialized, /Envio para todo o Brasil/);
  assert.match(serialized, /Embalagem fechada com 36 unidades/);
  assert.doesNotMatch(serialized, /Qtd\.|Atualizado em/);
});

test("builds one searchable catalog with a brand index and all brand sections", () => {
  const secondBrand: CustomerCatalogDownloadData = {
    brand: { id: "max-love", name: "Max Love" },
    productCount: 1,
    skuCount: 1,
    groups: [
      {
        id: "face",
        slug: "rosto",
        label: "Rosto",
        products: [
          {
            ...catalog.groups[0].products[0],
            id: "second-product",
            name: "Base Líquida Max Love",
            image: "/base-01.jpg",
            brandName: "Max Love",
            categoryLabel: "Rosto",
            skus: [{ id: "base-01", name: "Cor 01", code: "BASE-01", image: "/base-01.jpg", priceCents: 825 }]
          }
        ]
      }
    ]
  };
  const complete: CustomerCatalogCompleteDownloadData = {
    brands: [catalog, secondBrand],
    productCount: 2,
    skuCount: 3
  };

  assert.deepEqual(collectCustomerCatalogCompleteImageSources(complete, "/brand/header.webp"), [
    "/brand/header.webp",
    "/product.jpg",
    "/sku-01.jpg",
    "/sku-02.jpg",
    "/base-01.jpg"
  ]);

  const definition = buildCustomerCatalogCompletePdfDefinition(complete, {
    headerImage: "/brand/header.webp",
    imageData: new Map(),
    minimumOrderCents: 30000,
    whatsapp: "+55 11 97079-2390"
  });
  const serialized = JSON.stringify(definition);

  assert.match(serialized, /CATÁLOGO COMPLETO DE ATACADO/);
  assert.match(serialized, /ÍNDICE DE MARCAS/);
  assert.match(serialized, /Ruby Rose/);
  assert.match(serialized, /Max Love/);
  assert.match(serialized, /"tocItem":true/);
  assert.match(serialized, /Estoque disponível/);
});
