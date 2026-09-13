import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalog = readFileSync(new URL("./catalog.ts", import.meta.url), "utf8");
const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const selection = catalog.split("export async function getHomeProducts()")[1]?.split("export async function")[0] || "";

test("homepage selects original sample photos before limiting the shelf", () => {
  assert.match(selection, /productWhere\(\{ stockFilter: "ready" \}\)/);
  assert.ok(selection.includes('image: { contains: "/sku-" }'));
  assert.ok(selection.includes('NOT: { image: { contains: "/products/boards/" } }'));
  assert.ok(selection.includes('orderBy: [{ featuredRank: "asc" }, { id: "asc" }]'));
  assert.match(selection, /take: 8/);
  assert.match(selection, /select: productCardSelect/);
  assert.match(selection, /products\.map\(withProductCardDisplayText\)/);
});

test("homepage uses its own shelf without restricting the full catalogue", () => {
  assert.match(home, /getHomeProducts\(\)/);
  assert.doesNotMatch(home, /getProducts\(/);
  const catalogueQuery = catalog.split("export async function getProducts(")[1]?.split("export async function")[0] || "";
  assert.match(catalogueQuery, /where: productWhere\(options\)/);
  assert.doesNotMatch(catalogueQuery, /\/sku-/);
  assert.doesNotMatch(selection, /\.(update|upsert|delete|create)\(/);
});
