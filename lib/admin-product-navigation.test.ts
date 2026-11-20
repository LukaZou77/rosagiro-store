import assert from "node:assert/strict";
import { test } from "node:test";
import { productEditorPath, productListReturnPath } from "./admin-product-navigation";

test("product return navigation retains filters and pagination through a save", () => {
  const list = "/admin/produtos?q=R%C3%B3sea+%26+cor&brand=marca&category=pele&status=active&stock=out&page=3";
  const url = new URL(productEditorPath("/admin/produtos/produto-teste", list, true), "https://admin.invalid");
  assert.equal(url.searchParams.get("saved"), "1");
  assert.equal(productListReturnPath(url.searchParams.get("returnTo")), list);
});

test("product return navigation only accepts product list filters on the one list path", () => {
  for (const value of [null, "//example.com/admin/produtos?q=x", "/admin/produtos/novo?q=x", "/admin/pedidos?q=x", "/admin/produtos?x=y"]) {
    assert.equal(productListReturnPath(value), "/admin/produtos");
  }
  assert.equal(productListReturnPath("/admin/produtos?q=Rose&error=1&page=2#editor"), "/admin/produtos?q=Rose&page=2");
});
