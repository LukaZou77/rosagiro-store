import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductPackagePrice } from "./ProductPackagePrice";

test("renders the supplied package total with a separate unit reference", () => {
  const html = renderToStaticMarkup(
    <ProductPackagePrice packagePriceCents={32850} packagePieces={36} unitPriceCents={913} />
  );

  assert.match(html, /Total da embalagem/);
  assert.match(html, /R\$\s*328,50/);
  assert.match(html, /36 unidades/);
  assert.match(html, /R\$\s*9,13 por unidade/);
  assert.doesNotMatch(html, /R\$\s*328,68/);
});

test("does not invent package pricing when the helper result is unavailable", () => {
  assert.equal(
    renderToStaticMarkup(
      <ProductPackagePrice packagePriceCents={null} packagePieces={36} unitPriceCents={913} />
    ),
    ""
  );
});

test("product buying surfaces obtain package totals from the wholesale helper", () => {
  const page = readFileSync(new URL("../app/produto/[slug]/page.tsx", import.meta.url), "utf8");
  const card = readFileSync(new URL("./ProductCard.tsx", import.meta.url), "utf8");

  assert.match(page, /productWholesalePackagePriceCents\(product\)/);
  assert.match(card, /productWholesalePackagePriceCents\(product\)/);
  assert.doesNotMatch(page, /displayPrice\s*\*\s*packagePieces/);
  assert.doesNotMatch(card, /displayPrice\s*\*\s*packagePieces/);
});
