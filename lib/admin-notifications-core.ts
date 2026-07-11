export type AdminNotificationOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  totalCents: number;
};

export function adminNotificationDedupeKey(type: "NEW_ORDER" | "ORDER_PAID", orderId: string) {
  return `${type}:${orderId}`;
}

export function adminNotificationContent(type: "NEW_ORDER" | "ORDER_PAID", order: AdminNotificationOrder) {
  const total = (order.totalCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (type === "ORDER_PAID") {
    return {
      title: "Pagamento confirmado",
      message: `${order.orderNumber} de ${order.customerName} foi pago (${total}).`
    };
  }
  return {
    title: "Novo pedido recebido",
    message: `${order.orderNumber} de ${order.customerName} foi criado (${total}).`
  };
}
