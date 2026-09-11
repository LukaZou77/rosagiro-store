import assert from "node:assert/strict";
import test from "node:test";
import { buildAdjustedProductPricing, emptyPriceAdjustment, formatWholesalePackage } from "./product-price-adjustment";
import { productWholesaleLineTotalCents, productWholesalePackageLabel } from "./product-wholesale";
import { addWholesalePackageQuantity } from "./wholesale-order";
import { TS09002_SLUG, verifiedWholesaleBoxText } from "./verified-wholesale-package";

test("TS09002 uses one kit per box and keeps master cartons separate", () => {
  const box = verifiedWholesaleBoxText(TS09002_SLUG, 15000);
  assert.equal(box, "150,00c/1pçs");
  const pricing = buildAdjustedProductPricing({
    basePriceCents: 15000,
    descriptionPt: `Preço unitário: 150,00; Embalagem para atacado: ${box}.`,
    config: emptyPriceAdjustment
  });
  assert.equal(pricing.ok, true);
  if (!pricing.ok) return;
  assert.equal(pricing.baseBoxPieces, 1);
  assert.equal(pricing.baseBoxPriceCents, 15000);
  assert.equal(pricing.wholesalePackage, "Caixa com 1 unidade: R$ 150,00.");
  assert.equal(productWholesalePackageLabel(pricing), "Embalagem fechada com 1 unidade");
  assert.equal(addWholesalePackageQuantity(0, pricing.baseBoxPieces), 1);
  assert.equal(productWholesaleLineTotalCents(pricing, 1), 15000);
  assert.equal(productWholesaleLineTotalCents(pricing, 12), 180000);
});

test("reviewed packaging does not freeze prices or modify other products", () => {
  assert.equal(verifiedWholesaleBoxText(TS09002_SLUG, 16000), "160,00c/1pçs");
  assert.equal(verifiedWholesaleBoxText("maleta-completa-toque-special-ts09003", 15000), null);
  assert.equal(verifiedWholesaleBoxText("unrelated-ts09002", 15000), null);
  assert.equal(verifiedWholesaleBoxText(TS09002_SLUG, 0), null);
  assert.equal(formatWholesalePackage(180000, 12), "Caixa com 12 unidades: R$ 1800,00.");
});
