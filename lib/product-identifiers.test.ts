import assert from "node:assert/strict";
import test from "node:test";
import { cleanGtin, cleanMpn, isValidGtin } from "@/lib/product-identifiers";

test("normalizes and validates real GTIN values", () => {
  assert.equal(cleanGtin("7908346904040"), "7908346904040");
  assert.equal(cleanGtin("7908 3469 0404 0"), "7908346904040");
  assert.equal(isValidGtin("7908346904040"), true);
  assert.equal(isValidGtin("7908346904041"), false);
  assert.equal(isValidGtin("HB-L6203"), false);
});

test("keeps manufacturer references separate from storefront slugs", () => {
  assert.equal(cleanMpn(" HB-L6203 "), "HB-L6203");
  assert.equal(cleanMpn(""), null);
});
