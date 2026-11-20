import assert from "node:assert/strict";
import { test } from "node:test";
import { orderDetailFeedbackPath, orderListReturnPath } from "./admin-order-navigation";

test("order return navigation preserves filters and pagination but never accepts external destinations", () => {
  const list = "/admin/pedidos?q=RG-123&status=SHIPPED&page=3";
  assert.equal(orderListReturnPath(list), list);
  for (const value of ["https://example.com", "//example.com/admin/pedidos", "/admin/other", "/admin/pedidos/123", "/\\example.com/admin/pedidos", null]) {
    assert.equal(orderListReturnPath(value), "/admin/pedidos");
  }
  const url = new URL(orderDetailFeedbackPath("/admin/pedidos/RG-123", "saved", "1", list), "https://admin.invalid");
  assert.equal(url.searchParams.get("returnTo"), list);
  assert.equal(url.searchParams.get("saved"), "1");
  assert.equal(orderDetailFeedbackPath("/admin/pedidos/RG-123", "error", "Não permitido", undefined), "/admin/pedidos/RG-123?error=N%C3%A3o%20permitido");
});
