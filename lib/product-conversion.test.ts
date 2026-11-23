import assert from "node:assert/strict";
import test from "node:test";
import { productHeroBadge, productQuantity, productOrderQuantityLimit, productShortStockLabel, productStockLabel, productStockTone } from "./product-conversion";
import { productWholesaleOrderQuantityLimit } from "./product-wholesale";
import { isSourceCatalogConsultationProduct, isProductStockConsultationRequired } from "./source-catalog-product";

const consultationProduct = {
  stockStatus: "Sob consulta", inventory: { quantity: 0 }, skus: [],
  priceCents: 520, baseBoxPieces: 36, baseBoxPriceCents: 18720
};

test("unmanaged zero-stock source products remain orderable without rewriting stored stock", () => {
  const before = structuredClone(consultationProduct);
  assert.equal(isSourceCatalogConsultationProduct(consultationProduct), true);
  assert.equal(isProductStockConsultationRequired(consultationProduct), false);
  assert.equal(productQuantity(consultationProduct), 0);
  assert.ok(productOrderQuantityLimit(consultationProduct) >= 36);
  assert.equal(productStockTone(consultationProduct), "ready");
  assert.equal(productStockLabel(consultationProduct), "Disponível para pedido");
  assert.equal(productShortStockLabel(consultationProduct), "Disponível");
  assert.equal(productHeroBadge({ ...consultationProduct, badges: ["Destaque"] }), "Destaque");
  assert.deepEqual(consultationProduct, before);
});

test("unmanaged inventory does not replace missing package or price facts with a stock claim", () => {
  const missingPrice = { ...consultationProduct, baseBoxPriceCents: null };
  assert.equal(productStockTone(missingPrice), "consultation");
  assert.equal(productStockLabel(missingPrice), "Embalagem ou preço sob consulta");
  const missingPackage = { ...consultationProduct, baseBoxPieces: null };
  assert.equal(productStockTone(missingPackage), "consultation");
});

test("raw stock and opt-in managed stock behavior remain available for future stock management", () => {
  const ordinary = { ...consultationProduct, stockStatus: "Em estoque", inventory: { quantity: 12 } };
  assert.equal(productQuantity(ordinary), 12);
  assert.equal(productWholesaleOrderQuantityLimit(ordinary, true), 12);
  assert.equal(productWholesaleOrderQuantityLimit(consultationProduct, true), 0);
  assert.equal(isProductStockConsultationRequired(consultationProduct, true), true);
});
