import "server-only";

import { prisma } from "@/lib/db";
import { assertPaymentCanStart, startOrderPayment } from "@/lib/mercado-pago";
import { paymentModeForEnvironment } from "@/lib/payments";

export function pendingCheckoutPayment(orderNumber: string) {
  return {
    orderNumber,
    orderCreated: true as const,
    redirectTo: `/pedido/${encodeURIComponent(orderNumber)}`,
    externalRedirect: false,
    paymentPending: true,
    error: "Seu pedido foi salvo. A confirmação do pagamento ainda está pendente. Consulte este pedido antes de tentar pagar novamente."
  };
}

// Claim once durably. After an ambiguous provider response recover the saved order,
// never blindly start a second preference. Claims are deliberately not auto-expired.
export async function initializeCheckoutPayment(orderNumber: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber }, include: { payment: true } });
  const payment = order.payment;
  if (!payment) return pendingCheckoutPayment(orderNumber);
  if (order.status === "CANCELED" || (payment.status === "PAID" && payment.paidAt)) {
    return { orderNumber, orderCreated: true as const, redirectTo: `/pedido/${encodeURIComponent(orderNumber)}`, externalRedirect: false };
  }
  try {
    if (payment.providerPreferenceId) {
      const mode = paymentModeForEnvironment();
      const savedRedirect = mode === "mercado_pago_sandbox"
        ? payment.providerSandboxInitPoint || payment.providerInitPoint
        : mode === "mercado_pago_live" ? payment.providerInitPoint : null;
      // A mode change must never turn recovery of an existing preference into
      // another provider creation request outside the durable claim.
      if (!savedRedirect) return pendingCheckoutPayment(orderNumber);
      const result = await startOrderPayment(orderNumber);
      return { orderNumber, orderCreated: true as const, redirectTo: result.redirectTo, externalRedirect: result.external, paymentProvider: result.provider };
    }
    assertPaymentCanStart(payment.method);
    const claim = await prisma.payment.updateMany({
      where: { orderId: order.id, initializationStartedAt: null, status: { not: "PAID" }, order: { status: "PENDING_PAYMENT" } },
      data: { initializationStartedAt: new Date() }
    });
    if (claim.count !== 1) return pendingCheckoutPayment(orderNumber);
    const result = await startOrderPayment(orderNumber);
    return { orderNumber, orderCreated: true as const, redirectTo: result.redirectTo, externalRedirect: result.external, paymentProvider: result.provider };
  } catch {
    return pendingCheckoutPayment(orderNumber);
  }
}
