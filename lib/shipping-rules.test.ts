import assert from "node:assert/strict";
import test from "node:test";
import {
  billableWeightGrams,
  parseCheckoutShippingMethod,
  productShippingProfile,
  productWeightGrams,
  shippingWeightConfig
} from "./shipping-rules";

test("accepts only the shipping methods shown by the current checkout", () => {
  assert.equal(parseCheckoutShippingMethod("MELHOR_ENVIO"), "MELHOR_ENVIO");
  assert.equal(parseCheckoutShippingMethod(" retirada_local "), "RETIRADA_LOCAL");
  assert.equal(parseCheckoutShippingMethod("PADRAO"), null);
  assert.equal(parseCheckoutShippingMethod("EXPRESSA"), null);
  assert.equal(parseCheckoutShippingMethod(""), null);
});

test("uses confirmed weight with category dimensions and technical profiles otherwise", () => {
  assert.deepEqual(productShippingProfile({ name: "Lip Gloss", categorySlug: "labios", weightGrams: 52 }), {
    widthCm: 4,
    heightCm: 4,
    lengthCm: 14,
    weightGrams: 52,
    source: "confirmed-weight"
  });
  assert.deepEqual(productShippingProfile({ name: "Paleta de sombras", categorySlug: "olhos-sobrancelhas" }), {
    widthCm: 18,
    heightCm: 4,
    lengthCm: 24,
    weightGrams: 280,
    source: "technical-profile"
  });
});

test("uses 150 g when a product has no confirmed weight", () => {
  assert.equal(shippingWeightConfig.fallbackProductWeightGrams, 150);
  assert.equal(productWeightGrams(null), 150);
  assert.equal(productWeightGrams(undefined), 150);
  assert.equal(productWeightGrams(0), 150);
  assert.equal(productWeightGrams(-20), 150);
  assert.equal(productWeightGrams(248.9), 248);
});

test("adds 150 g of packaging to the product total", () => {
  assert.equal(shippingWeightConfig.packagingWeightGrams, 150);
  assert.equal(billableWeightGrams(productWeightGrams(null)), 300);
  assert.equal(billableWeightGrams(productWeightGrams(null) * 3), 600);
});
