import assert from "node:assert/strict";

import {
  adjustPriceCents,
  adjustStandardWholesaleDescription,
  buildAdjustedProductPricing,
  parsePriceAdjustmentInput
} from "../lib/product-price-adjustment";

const increasePercent = parsePriceAdjustmentInput({ direction: "increase", type: "percent", value: "20" });
assert.equal(adjustPriceCents(820, increasePercent), 984);
assert.equal(
  adjustStandardWholesaleDescription("Preço unitário: 8,20; Embalagem para atacado: 295,20c/36pçs.", 820, increasePercent)
    .description,
  "Preço unitário: 9,84; Embalagem para atacado: 354,24c/36pçs."
);

const increaseFixed = parsePriceAdjustmentInput({ direction: "increase", type: "fixed", value: "1" });
assert.equal(adjustPriceCents(820, increaseFixed), 920);
assert.equal(
  adjustStandardWholesaleDescription("Preço unitário: 8,20; Embalagem para atacado: 295,20c/36pçs.", 820, increaseFixed)
    .description,
  "Preço unitário: 9,20; Embalagem para atacado: 331,20c/36pçs."
);

const decreaseFixed = parsePriceAdjustmentInput({ direction: "decrease", type: "fixed", value: "1" });
assert.equal(adjustPriceCents(820, decreaseFixed), 720);
assert.equal(
  adjustStandardWholesaleDescription("Preço unitário: 8,20; Embalagem para atacado: 295,20c/36pçs.", 820, decreaseFixed)
    .description,
  "Preço unitário: 7,20; Embalagem para atacado: 259,20c/36pçs."
);

assert.equal(adjustPriceCents(50, decreaseFixed), null);
assert.equal(
  adjustStandardWholesaleDescription("Preço unitário: 8,20; Embalagem para atacado: consulte pelo WhatsApp.", 820, increaseFixed)
    .description,
  "Preço unitário: 9,20; Embalagem para atacado: consulte pelo WhatsApp."
);

const built = buildAdjustedProductPricing({
  basePriceCents: 820,
  descriptionPt: "Preço unitário: 8,20; Embalagem para atacado: 295,20c/36pçs.",
  config: increasePercent
});
assert.equal(built.ok, true);
if (built.ok) {
  assert.equal(built.priceCents, 984);
  assert.equal(built.baseBoxPriceCents, 29520);
  assert.equal(built.baseBoxPieces, 36);
  assert.equal(built.descriptionPt, "Preço unitário: 9,84; Embalagem para atacado: 354,24c/36pçs.");
  assert.equal(built.wholesalePackage, "Caixa com 36 unidades: R$ 354,24.");
}

const editorial = buildAdjustedProductPricing({
  basePriceCents: 820,
  descriptionPt: "Batom líquido com acabamento matte e gloss incolor no mesmo produto.",
  wholesalePackage: "Caixa com 36 unidades: R$ 295,20.",
  baseBoxPriceCents: 29520,
  baseBoxPieces: 36,
  config: increasePercent
});
assert.equal(editorial.ok, true);
if (editorial.ok) {
  assert.equal(editorial.descriptionPt, "Batom líquido com acabamento matte e gloss incolor no mesmo produto.");
  assert.equal(editorial.wholesalePackage, "Caixa com 36 unidades: R$ 354,24.");
}

console.log("price adjustment tests passed");
