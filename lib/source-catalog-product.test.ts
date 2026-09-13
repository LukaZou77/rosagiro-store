import assert from "node:assert/strict";
import test from "node:test";
import {
  isSourceCatalogConsultationProduct,
  sourceCatalogPackageText,
  sourceCatalogPriceLabel,
  sourceCatalogVerifiedSaleUnit
} from "./source-catalog-product";

test("recognizes only the exact source-catalog consultation marker", () => {
  assert.equal(isSourceCatalogConsultationProduct({ stockStatus: "Sob consulta" }), true);
  assert.equal(isSourceCatalogConsultationProduct({ stockStatus: "sob consulta" }), false);
  assert.equal(isSourceCatalogConsultationProduct({ stockStatus: "Sob consulta " }), false);
  assert.equal(isSourceCatalogConsultationProduct({ stockStatus: null }), false);
});

test("uses only an explicit verified sale-unit prefix", () => {
  assert.equal(
    sourceCatalogVerifiedSaleUnit("Unidade de venda: pacote. Caixa: 24 unidades; preço da caixa: R$ 144,00."),
    "pacote"
  );
  assert.equal(sourceCatalogVerifiedSaleUnit("Unidade de venda: kit. Consulte a caixa."), "kit");
  assert.equal(sourceCatalogVerifiedSaleUnit("Kit com 4 itens."), null);
  assert.equal(sourceCatalogVerifiedSaleUnit("Caixa: 24 unidades."), null);
});

test("labels source prices without inferring a sale unit", () => {
  assert.equal(sourceCatalogPriceLabel("Unidade de venda: cartela. Caixa sob consulta."), "Preço por cartela");
  assert.equal(sourceCatalogPriceLabel("Produto em kit; caixa sob consulta."), "Preço unitário da imagem");
  assert.equal(sourceCatalogPriceLabel(null), "Preço unitário da imagem");
});

test("retains all verified source packaging sale units without changing the quote", () => {
  for (const unit of ["kit", "miniembalagem", "embalagem de lenços", "estojo", "maleta"]) {
    const text = `Unidade de venda: ${unit}. Pacote: 8 miniembalagens; preço da embalagem R$ 8,50.`;
    assert.equal(sourceCatalogVerifiedSaleUnit(text), unit);
    assert.equal(sourceCatalogPriceLabel(text), `Preço por ${unit}`);
    assert.equal(sourceCatalogPackageText(text), "Pacote: 8 miniembalagens; preço da embalagem R$ 8,50.");
  }
  assert.equal(sourceCatalogPackageText(null), "");
  assert.equal(sourceCatalogVerifiedSaleUnit("Unidade de venda: Preço por kit."), null);
});
