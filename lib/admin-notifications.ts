import "server-only";

import { prisma } from "@/lib/db";
import {
  adminNotificationContent,
  adminNotificationDedupeKey,
  type AdminNotificationOrder
} from "@/lib/admin-notifications-core";

async function createOrderNotification(type: "NEW_ORDER" | "ORDER_PAID", order: AdminNotificationOrder) {
  const content = adminNotificationContent(type, order);
  try {
    return await prisma.adminNotification.create({
      data: {
        notificationType: type,
        dedupeKey: adminNotificationDedupeKey(type, order.id),
        title: content.title,
        message: content.message,
        actionHref: `/admin/pedidos/${order.orderNumber}`,
        entityType: "ORDER",
        entityId: order.id,
        whatsappStatus: "NOT_CONFIGURED"
      }
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return prisma.adminNotification.findUnique({
        where: { dedupeKey: adminNotificationDedupeKey(type, order.id) }
      });
    }
    throw error;
  }
}

export function notifyNewOrder(order: AdminNotificationOrder) {
  return createOrderNotification("NEW_ORDER", order);
}

export function notifyOrderPaid(order: AdminNotificationOrder) {
  return createOrderNotification("ORDER_PAID", order);
}

export async function createOrderNotificationSafely(type: "NEW_ORDER" | "ORDER_PAID", order: AdminNotificationOrder) {
  try {
    await createOrderNotification(type, order);
  } catch {
    // Notifications are operational aids and must never block checkout or payment confirmation.
  }
}
