import assert from "node:assert/strict";
import test from "node:test";
import {
  productCommercialSummary,
  productEditorialDescription,
  productWholesalePackageLabel,
  productWholesaleLineTotalCents,
  productWholesalePackagePieces,
  productWholesalePackagePriceCents,
  productWholesaleStockQuantity,
  wholesalePackageFromLegacyDescription
} from "./product-wholesale";

test("preserves unit price and box terms from legacy product descriptions", () => {
  const description = "Preço unitário: 10,38; Embalagem para atacado: 373,50c/36pçs.";

  assert.equal(wholesalePackageFromLegacyDescription(description), "Caixa com 36 unidades: R$ 373,50.");
  assert.equal(
    productCommercialSummary({ priceCents: 1038, wholesalePackage: null, descriptionPt: description }),
    "Preço unitário no atacado: R$ 10,38. Embalagem fechada com 36 unidades: R$ 373,50."
  );
  assert.equal(productEditorialDescription(description), "");
});

test("keeps researched editorial copy separate from wholesale terms", () => {
  const description = "Batom líquido com acabamento matte e gloss incolor no mesmo produto.";

  assert.equal(productEditorialDescription(description), description);
  assert.equal(
    productCommercialSummary({
      priceCents: 975,
      wholesalePackage: "Caixa com 36 unidades: R$ 351,00.",
      descriptionPt: description
    }),
    "Preço unitário no atacado: R$ 9,75. Embalagem fechada com 36 unidades: R$ 351,00."
  );
});

test("keeps WhatsApp consultation terms visible", () => {
  const description = "Preço unitário: 8,13; Embalagem para atacado: consulte pelo WhatsApp.";

  assert.equal(
    wholesalePackageFromLegacyDescription(description),
    "Caixa fechada e volumes maiores: consulte pelo WhatsApp."
  );
});

test("resolves a reliable closed-package quantity", () => {
  assert.equal(productWholesalePackagePieces({ baseBoxPieces: 36, wholesalePackage: null }), 36);
  assert.equal(productWholesalePackagePieces({ wholesalePackage: "Caixa com 48 unidades: R$ 270,24." }), 48);
  assert.equal(productWholesalePackagePieces({ wholesalePackage: "Consulte no WhatsApp" }), null);
  assert.equal(
    productWholesalePackageLabel({ baseBoxPieces: 24, wholesalePackage: null }),
    "Embalagem fechada com 24 unidades"
  );
});

test("uses product-level stock for closed mixed packages", () => {
  assert.equal(
    productWholesaleStockQuantity({
      inventory: { quantity: 48 },
      skus: [
        { active: true, quantity: 999 },
        { active: true, quantity: 999 }
      ]
    }),
    48
  );
  assert.equal(
    productWholesaleStockQuantity({
      inventory: null,
      skus: [
        { active: true, quantity: 12 },
        { active: false, quantity: 40 }
      ]
    }),
    12
  );
});

test("uses the authoritative package price instead of multiplying a rounded unit price", () => {
  const product = {
    priceCents: 913,
    baseBoxPriceCents: 26280,
    baseBoxPieces: 36,
    wholesalePackage: "Embalagem fechada com 36 unidades: R$ 328,50."
  };

  assert.equal(productWholesalePackagePriceCents(product), 32850);
  assert.equal(productWholesaleLineTotalCents(product, 36), 32850);
  assert.equal(productWholesaleLineTotalCents(product, 72), 65700);
  assert.equal(productWholesaleLineTotalCents(product, 1), 0);
});
