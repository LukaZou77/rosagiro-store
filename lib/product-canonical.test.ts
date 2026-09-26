import test from "node:test";
import assert from "node:assert/strict";
import { productCanonicalAliases, verifiedProductCanonicalSlug } from "@/lib/product-canonical";
import { productDisplayName } from "@/lib/display-text";

const slug = "paleta-de-sombra-glitter-12-cores-vivai-2172-1-1";
const product = { slug, active: true, priceCents: 670, baseBoxPieces: 24, baseBoxPriceCents: 16080, brand: { name: "ViVai" } };
const target = { ...product, slug: productCanonicalAliases[slug] };

test("canonicalizes only the individually verified duplicate", () => {
  assert.equal(verifiedProductCanonicalSlug(product, target), target.slug);
  assert.equal(verifiedProductCanonicalSlug({ ...product, slug: "paleta-de-sombra-glitter-12-cores-vivai-217211-01" }, target), "paleta-de-sombra-glitter-12-cores-vivai-217211-01");
  assert.equal(verifiedProductCanonicalSlug(target, product), target.slug);
});

test("falls back to the original page if the target disappears or terms diverge", () => {
  for (const candidate of [null, { ...target, active: false }, { ...target, priceCents: 700 }, { ...target, baseBoxPieces: 12 }, { ...target, baseBoxPriceCents: 16000 }, { ...target, brand: { name: "Other" } }]) {
    assert.equal(verifiedProductCanonicalSlug(product, candidate), slug);
  }
});

test("removes placeholder brand prefixes without changing real product names", () => {
  assert.equal(productDisplayName("Marca não informada Paleta MYJ-0920", "Marca não informada"), "Paleta MYJ-0920");
  assert.equal(productDisplayName("Paleta MYJ-0920", "Marca não informada"), "Paleta MYJ-0920");
  assert.equal(productDisplayName("Ruby Rose Paleta", "Ruby Rose"), "Ruby Rose Paleta");
});
