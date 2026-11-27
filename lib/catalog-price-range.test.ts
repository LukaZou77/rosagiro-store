import assert from "node:assert/strict";
import test from "node:test";
import { catalogPriceRanges, matchesCatalogPriceRange, parseCatalogPriceRange, type CatalogPriceRange } from "./catalog-price-range";
import { productCardDisplayUnitPriceCents } from "./product-wholesale";

test("assigns each valid unit price to exactly one range at the boundaries", () => {
  const examples: Array<[number, CatalogPriceRange]> = [
    [99, "under-1"], [100, "1-5"], [499, "1-5"], [500, "5-10"], [999, "5-10"],
    [1000, "10-15"], [1500, "15-20"], [2000, "20-25"], [2500, "25-plus"]
  ];
  const ranges = Object.keys(catalogPriceRanges).map(parseCatalogPriceRange);

  for (const [priceCents, expectedRange] of examples) {
    assert.deepEqual(ranges.filter((range) => matchesCatalogPriceRange(priceCents, range)), [expectedRange]);
  }
  assert.equal(parseCatalogPriceRange("constructor"), "all");
  assert.equal(parseCatalogPriceRange(undefined), "all");
});

test("uses the rounded card unit price from the package total", () => {
  const priceCents = productCardDisplayUnitPriceCents({ priceCents: 499, baseBoxPriceCents: 1499, baseBoxPieces: 3 });
  assert.equal(priceCents, 500);
  assert.equal(matchesCatalogPriceRange(priceCents, "5-10"), true);
});

test("only uses confirmed per-unit prices for source consultation products", () => {
  const product = { priceCents: 550, stockStatus: "Sob consulta" };

  assert.equal(productCardDisplayUnitPriceCents(product), null);
  assert.equal(productCardDisplayUnitPriceCents({ ...product, wholesalePackage: "Unidade de venda: kit." }), null);
  assert.equal(productCardDisplayUnitPriceCents({ ...product, wholesalePackage: "Unidade de venda: unidade." }), 550);
});

test("uses legacy package totals when they override the stored package price", () => {
  const priceCents = productCardDisplayUnitPriceCents({
    priceCents: 499,
    baseBoxPriceCents: 1499,
    baseBoxPieces: 3,
    descriptionPt: "Preço unitário: 4,99; Embalagem para atacado: 30,00c/3pçs."
  });

  assert.equal(priceCents, 1000);
  assert.equal(matchesCatalogPriceRange(priceCents, "5-10"), false);
  assert.equal(matchesCatalogPriceRange(priceCents, "10-15"), true);
});

test("does not include missing or invalid prices in a priced range", () => {
  const ranges = Object.keys(catalogPriceRanges).map(parseCatalogPriceRange);
  for (const priceCents of [0, -1, Number.NaN]) {
    assert.deepEqual(ranges.filter((range) => matchesCatalogPriceRange(priceCents, range)), []);
  }
  assert.equal(parseCatalogPriceRange("not-a-range"), "all");
});
