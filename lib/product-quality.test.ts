import assert from "node:assert/strict";
import test from "node:test";
import { productStockQualityIssue } from "./product-quality-stock";

test("exact consultation marker becomes a low manual-review issue", () => {
  assert.deepEqual(productStockQualityIssue({ active: true, stockStatus: "Sob consulta" }, 0), {
    key: "consultation-stock-review",
    group: "operation",
    severity: "low",
    label: "Estoque sob consulta",
    message: "Confirme manualmente o estoque antes de liberar a compra deste item."
  });
});

test("only the exact consultation marker receives the exception", () => {
  const issue = productStockQualityIssue({ active: true, stockStatus: "Sob consulta " }, 0);
  assert.equal(issue?.key, "active-out-of-stock");
  assert.equal(issue?.severity, "high");
});

test("ordinary active product with zero stock keeps the high issue", () => {
  const issue = productStockQualityIssue({ active: true, stockStatus: "Sem estoque" }, 0);
  assert.equal(issue?.key, "active-out-of-stock");
  assert.equal(issue?.severity, "high");
});

test("ordinary active product with stock has no stock issue", () => {
  assert.equal(productStockQualityIssue({ active: true, stockStatus: "Em estoque" }, 10), null);
});
