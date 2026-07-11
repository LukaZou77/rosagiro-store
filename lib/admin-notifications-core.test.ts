import assert from "node:assert/strict";
import test from "node:test";
import { adminNotificationContent, adminNotificationDedupeKey } from "@/lib/admin-notifications-core";

const order = { id: "order-123", orderNumber: "RG-123", customerName: "Maria", totalCents: 12345 };

test("gera chaves de deduplicacao distintas por evento", () => {
  assert.equal(adminNotificationDedupeKey("NEW_ORDER", order.id), "NEW_ORDER:order-123");
  assert.equal(adminNotificationDedupeKey("ORDER_PAID", order.id), "ORDER_PAID:order-123");
});

test("gera mensagens locais sem dados extras", () => {
  assert.deepEqual(adminNotificationContent("NEW_ORDER", order), {
    title: "Novo pedido recebido",
    message: "RG-123 de Maria foi criado (R$ 123,45)."
  });
  assert.deepEqual(adminNotificationContent("ORDER_PAID", order), {
    title: "Pagamento confirmado",
    message: "RG-123 de Maria foi pago (R$ 123,45)."
  });
});
