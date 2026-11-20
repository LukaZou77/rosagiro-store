import assert from "node:assert/strict";
import test from "node:test";
import {
  addWholesalePackageQuantity,
  MAX_WHOLESALE_LINE_QUANTITY,
  normalizeWholesaleLineQuantity,
  roundUpToWholesalePackage,
  wholesaleMinimumReached,
  wholesaleMinimumRemainingCents,
  wholesaleReferenceUnitPriceCents
} from "./wholesale-order";

test("normalizes quantities for wholesale orders without a retail-sized cap", () => {
  assert.equal(normalizeWholesaleLineQuantity(0), 0);
  assert.equal(normalizeWholesaleLineQuantity(117), 117);
  assert.equal(normalizeWholesaleLineQuantity(5000), 5000);
  assert.equal(normalizeWholesaleLineQuantity(MAX_WHOLESALE_LINE_QUANTITY + 1), MAX_WHOLESALE_LINE_QUANTITY);
  assert.equal(normalizeWholesaleLineQuantity(Infinity), 0);
});

test("treats the wholesale minimum as a required checkout threshold", () => {
  assert.equal(wholesaleMinimumRemainingCents(975, 50000), 49025);
  assert.equal(wholesaleMinimumReached(49999, 50000), false);
  assert.equal(wholesaleMinimumReached(50000, 50000), true);
});

test("rounds legacy quantities up to a complete manufacturer package", () => {
  assert.equal(roundUpToWholesalePackage(2, 36), 36);
  assert.equal(roundUpToWholesalePackage(36, 36), 36);
  assert.equal(roundUpToWholesalePackage(37, 36), 72);
  assert.equal(roundUpToWholesalePackage(999, 36), 1008);
  assert.equal(roundUpToWholesalePackage(37, 36, 50), 36);
  assert.equal(roundUpToWholesalePackage(10, 36, 35), 0);
  assert.equal(roundUpToWholesalePackage(12, null), 0);
});

test("adds only complete manufacturer packages and respects available stock", () => {
  assert.equal(addWholesalePackageQuantity(0, 36), 36);
  assert.equal(addWholesalePackageQuantity(36, 36), 72);
  assert.equal(addWholesalePackageQuantity(1, 36), 72);
  assert.equal(addWholesalePackageQuantity(36, 36, 50), 36);
  assert.equal(addWholesalePackageQuantity(0, 36, 20), 0);
  assert.equal(addWholesalePackageQuantity(972, 36, 1080), 1008);
  assert.equal(addWholesalePackageQuantity(72, 36, 50), 72);
  assert.equal(addWholesalePackageQuantity(72, 36, 12), 72);
});

test("rounds the unit reference without adjusting the authoritative package price", () => {
  assert.equal(wholesaleReferenceUnitPriceCents(32850, 36), 913);
  assert.equal(wholesaleReferenceUnitPriceCents(37350, 36), 1038);
});
