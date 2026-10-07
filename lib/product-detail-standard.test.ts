import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { productDetailPurchaseNotice } from "./product-detail-standard";

test("confirmed package quantity and price only require stock confirmation", () => {
  assert.deepEqual(productDetailPurchaseNotice({
    consultationOnly: true, packagePieces: 12, packagePriceCents: 6600
  }), {
    title: "Embalagem fechada com 12 unidades",
    description: "Confirme a disponibilidade em estoque pelo WhatsApp antes do pedido."
  });
});

test("a known quantity with an unknown total asks for price and stock only", () => {
  for (const price of [null, 0]) {
    const notice = productDetailPurchaseNotice({
      consultationOnly: true, packagePieces: 12, packagePriceCents: price
    });
    assert.equal(notice.title, "Embalagem fechada com 12 unidades");
    assert.equal(notice.description, "Confirme o valor total da embalagem e a disponibilidade em estoque pelo WhatsApp antes do pedido.");
  }
});

test("missing package quantity still requires packaging confirmation", () => {
  for (const pieces of [null, 0]) {
    const notice = productDetailPurchaseNotice({
      consultationOnly: true, packagePieces: pieces, packagePriceCents: 6600
    });
    assert.equal(notice.title, "Condição de compra sob consulta");
    assert.match(notice.description, /unidade de venda e composição da embalagem/);
  }
});

test("single-unit closed packages use the singular form", () => {
  assert.equal(productDetailPurchaseNotice({
    consultationOnly: true, packagePieces: 1, packagePriceCents: 550
  }).title, "Embalagem fechada com 1 unidade");
});

test("regular stock retains the original closed-package notice", () => {
  assert.deepEqual(productDetailPurchaseNotice({
    consultationOnly: false, packagePieces: 12, packagePriceCents: 6600
  }), {
    title: "Embalagem fechada do fabricante",
    description: "As cores e variações vêm na composição original da embalagem. Não é possível escolher cores nem fracionar unidades."
  });
});

test("detail page uses the notice without removing the stock consultation gate", () => {
  const page = readFileSync(new URL("../app/produto/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /productDetailPurchaseNotice\(\{ consultationOnly, packagePieces, packagePriceCents \}\)/);
  assert.match(page, /<strong>\{purchaseNotice\.title\}<\/strong>/);
  assert.match(page, /<span>\{purchaseNotice\.description\}<\/span>/);
  assert.match(page, /packagePieces && packagePriceCents\s*\? "Venda por embalagem fechada/);
  assert.match(page, /!consultationOnly && packagePieces && quantity >= packagePieces/);
  assert.match(page, /consultationOnly \? \(\s*<span[^>]+aria-disabled="true">\s*Estoque sob consulta/);
});
