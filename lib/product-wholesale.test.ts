import assert from "node:assert/strict";
import test from "node:test";
import {
  productCommercialSummary,
  productEditorialDescription,
  wholesalePackageFromLegacyDescription
} from "./product-wholesale";

test("preserves unit price and box terms from legacy product descriptions", () => {
  const description = "Preço unitário: 10,38; Embalagem para atacado: 373,50c/36pçs.";

  assert.equal(wholesalePackageFromLegacyDescription(description), "Caixa com 36 unidades: R$ 373,50.");
  assert.equal(
    productCommercialSummary({ priceCents: 1038, wholesalePackage: null, descriptionPt: description }),
    "Preço unitário: R$ 10,38. Caixa com 36 unidades: R$ 373,50."
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
    "Preço unitário: R$ 9,75. Caixa com 36 unidades: R$ 351,00."
  );
});

test("keeps WhatsApp consultation terms visible", () => {
  const description = "Preço unitário: 8,13; Embalagem para atacado: consulte pelo WhatsApp.";

  assert.equal(
    wholesalePackageFromLegacyDescription(description),
    "Caixa fechada e volumes maiores: consulte pelo WhatsApp."
  );
});
