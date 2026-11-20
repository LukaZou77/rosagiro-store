import { simulatedPaymentConfirmedStatus } from "@/lib/payments";
import type { OrderStatus, Prisma } from "@/src/generated/prisma/client";

export const orderStatuses = ["PENDING_PAYMENT", "PAID", "FULFILLING", "SHIPPED", "CANCELED"] as const;
export const confirmedPaymentWhere = {
  status: "PAID",
  paidAt: { not: null },
  OR: [{ providerStatus: null }, { providerStatus: { not: simulatedPaymentConfirmedStatus } }]
} satisfies Prisma.PaymentWhereInput;

export function canUpdateOrderStatus(current: OrderStatus, next: OrderStatus, paymentConfirmed: boolean) {
  if (next === "PAID") return current === "PAID";
  if (next === "PENDING_PAYMENT") return !paymentConfirmed;
  if (next === "FULFILLING" || next === "SHIPPED") return paymentConfirmed;
  return true;
}

export function orderStatusChoices(current: OrderStatus, paymentConfirmed: boolean) {
  return orderStatuses.filter((status) => status === current || canUpdateOrderStatus(current, status, paymentConfirmed));
}
