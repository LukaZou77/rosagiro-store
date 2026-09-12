import assert from "node:assert/strict";
import test from "node:test";
import {
  productHeroBadge,
  productQuantity,
  productShortStockLabel,
  productStockLabel,
  productStockTone
} from "./product-conversion";

const consultationProduct = {
  stockStatus: "Sob consulta",
  inventory: { quantity: 999 },
  skus: [{ active: true, quantity: 999 }]
};

test("keeps source-catalog consultation products unavailable regardless of numeric stock", () => {
  assert.equal(productQuantity(consultationProduct), 0);
  assert.equal(productStockTone(consultationProduct), "consultation");
  assert.equal(productStockLabel(consultationProduct), "Estoque sob consulta");
  assert.equal(productShortStockLabel(consultationProduct), "Sob consulta");
  assert.equal(productHeroBadge({ ...consultationProduct, badges: ["Destaque"] }), "Sob consulta");
});

test("does not change ordinary product stock behavior", () => {
  const ordinary = { stockStatus: "Em estoque", inventory: { quantity: 12 }, skus: [] };
  assert.equal(productQuantity(ordinary), 12);
  assert.equal(productStockTone(ordinary), "ready");
  assert.equal(productStockLabel(ordinary), "Em estoque");
});
