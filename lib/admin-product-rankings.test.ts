import assert from "node:assert/strict";
import test from "node:test";
import { rankProductMetricRows } from "@/lib/admin-product-rankings";

test("ordena por valor, desempata por receita e ignora zero", () => {
  const ranked = rankProductMetricRows([
    { productKey: "zero", value: 0, tieBreaker: 9999 },
    { productKey: "second", value: 3, tieBreaker: 100 },
    { productKey: "first", value: 3, tieBreaker: 200 }
  ]);
  assert.deepEqual(ranked.map((row) => [row.productKey, row.rank]), [["first", 1], ["second", 2]]);
});

test("produto sem valor no periodo anterior permanece novo", () => {
  const previousRanks = new Map(
    rankProductMetricRows([{ productKey: "product", value: 0, tieBreaker: 500 }]).map((row) => [row.productKey, row.rank])
  );
  assert.equal(previousRanks.get("product"), undefined);
});
