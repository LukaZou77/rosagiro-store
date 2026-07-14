import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOG_WHOLESALE_CONSULT_TEXT,
  catalogSkuRows,
  catalogStockLabel,
  catalogUnitPriceLabel,
  catalogWholesaleLabel,
  customerCatalogBrandFileName,
  customerCatalogCompleteFileName,
  customerCatalogDocumentTitle,
  hasCatalogWholesalePrice,
  normalizeCatalogPage,
  normalizeCatalogPriceStatus,
  normalizeCatalogQuery
} from "./admin-customer-catalog-core";

test("normalizes catalog filters without accepting unsupported values", () => {
  assert.equal(normalizeCatalogQuery(["  Ruby Rose HB-L6509  "]), "Ruby Rose HB-L6509");
  assert.equal(normalizeCatalogPriceStatus("priced"), "priced");
  assert.equal(normalizeCatalogPriceStatus("unknown"), "all");
  assert.equal(normalizeCatalogPage("3"), 3);
  assert.equal(normalizeCatalogPage("-2"), 1);
});

test("keeps real wholesale-package pricing and uses consultation text when it is missing", () => {
  const priced = "Caixa com 24 unidades: R$ 450,00.";
  assert.equal(hasCatalogWholesalePrice(priced), true);
  assert.equal(catalogWholesaleLabel(priced), "Embalagem fechada com 24 unidades: R$ 450,00.");
  assert.equal(hasCatalogWholesalePrice("Consulte pelo WhatsApp"), false);
  assert.equal(catalogWholesaleLabel("Consulte pelo WhatsApp"), CATALOG_WHOLESALE_CONSULT_TEXT);
  assert.equal(catalogWholesaleLabel(null), CATALOG_WHOLESALE_CONSULT_TEXT);
});

test("uses truthful stock labels without exposing a quantity field", () => {
  assert.equal(catalogStockLabel(true), "Estoque disponível");
  assert.equal(catalogStockLabel(false), "Consulte disponibilidade");
});

test("groups unique SKU models and falls back to the public product image", () => {
  const rows = catalogSkuRows({
    productImage: "/produto.jpg",
    productPriceCents: 650,
    mpn: null,
    skus: [
      { id: "one", name: "Cor 01", code: "376-01", image: "/376-01.jpg", priceCents: null },
      { id: "two", name: "Cor 02", code: "376-02", image: null, priceCents: 700 },
      { id: "duplicate", name: "Duplicado", code: "376-02", image: "/duplicado.jpg", priceCents: 700 }
    ]
  });

  assert.deepEqual(rows, [
    { id: "one", name: "Cor 01", code: "376-01", image: "/376-01.jpg", priceCents: 650 },
    { id: "two", name: "Cor 02", code: "376-02", image: "/produto.jpg", priceCents: 700 }
  ]);
});

test("shows a future SKU price range without changing current equal-price products", () => {
  assert.equal(
    catalogUnitPriceLabel(650, [
      { id: "one", name: "01", code: "01", image: null, priceCents: 650 },
      { id: "two", name: "02", code: "02", image: null, priceCents: 650 }
    ]),
    "R$\u00a06,50"
  );
  assert.equal(
    catalogUnitPriceLabel(650, [
      { id: "one", name: "01", code: "01", image: null, priceCents: 650 },
      { id: "two", name: "02", code: "02", image: null, priceCents: 700 }
    ]),
    "R$\u00a06,50 a R$\u00a07,00"
  );
});

test("uses only the safe brand name for PDF files", () => {
  assert.equal(customerCatalogDocumentTitle("Ruby Rose"), "Ruby Rose");
  assert.equal(customerCatalogBrandFileName('  Marca / Especial: 01  '), "Marca - Especial - 01");
  assert.equal(customerCatalogCompleteFileName(), "Catalogo completo RosaGiro.pdf");
});
