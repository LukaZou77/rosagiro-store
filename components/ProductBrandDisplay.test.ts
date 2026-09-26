import assert from "node:assert/strict";
import test from "node:test";
import { shouldDisplayProductBrand } from "./ProductBrandDisplay";

test("hides only the missing-brand placeholder from customer-facing product UI", () => {
  assert.equal(shouldDisplayProductBrand("Marca não informada"), false);
  assert.equal(shouldDisplayProductBrand("  MARCA NÃO INFORMADA  "), false);
  assert.equal(shouldDisplayProductBrand("  "), false);
  assert.equal(shouldDisplayProductBrand("Ruby Rose"), true);
});
