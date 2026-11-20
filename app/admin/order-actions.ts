"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { orderDetailFeedbackPath, orderListReturnPath } from "@/lib/admin-order-navigation";
import { prisma } from "@/lib/db";
import { canUpdateOrderStatus, orderStatuses } from "@/lib/order-fulfillment";
import { markOrderPaid, OrderError } from "@/lib/orders";
import { isPaymentConfirmed } from "@/lib/payments";
import { recordCreatedOrderProductMetrics } from "@/lib/product-daily-metrics";
import type { OrderStatus } from "@/src/generated/prisma/client";

function orderDetailLoginReturnPath(detailPath: string, returnTo: FormDataEntryValue | null) {
  const listPath = orderListReturnPath(returnTo);
  return listPath === "/admin/pedidos" ? detailPath : `${detailPath}?${new URLSearchParams({ returnTo: listPath })}`;
}

export async function updateOrderStatusAction(formData: FormData) {
  const orderNumber = String(formData.get("orderNumber") || "").trim();
  const detailPath = `/admin/pedidos/${encodeURIComponent(orderNumber)}`;
  const returnTo = formData.get("returnTo");
  await requireAdmin(orderNumber ? orderDetailLoginReturnPath(detailPath, returnTo) : "/admin/pedidos");

  const status = String(formData.get("status") || "") as OrderStatus;
  if (!orderNumber || !orderStatuses.includes(status)) {
    redirect("/admin/pedidos?error=1");
  }
  const hasShipment = formData.has("fulfillmentCarrier") || formData.has("trackingCode");
  const fulfillmentCarrier = String(formData.get("fulfillmentCarrier") || "").trim();
  const trackingCode = String(formData.get("trackingCode") || "").trim();
  if (hasShipment && (Boolean(fulfillmentCarrier) !== Boolean(trackingCode) || fulfillmentCarrier.length > 100 || trackingCode.length > 120)) {
    redirect(orderDetailFeedbackPath(detailPath, "error", "Preencha a transportadora e o código de rastreio. / 请同时填写快递公司和物流单号。", returnTo));
  }

  const update = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE "orderNumber" = ${orderNumber} FOR UPDATE`;
    const current = await tx.order.findUnique({
      where: { orderNumber },
      select: { id: true, status: true, payment: { select: { status: true, paidAt: true, providerStatus: true } } }
    });
    if (!current) return { error: "Pedido não encontrado. / 未找到订单。" } as const;
    const confirmed = isPaymentConfirmed(current.payment?.status, current.payment?.paidAt, current.payment?.providerStatus);
    if (!canUpdateOrderStatus(current.status, status, confirmed)) {
      return { error: "Status incompatível com o pagamento. Confira o pagamento antes de seguir. / 状态与付款记录不符，请先核对款项。" } as const;
    }
    await tx.order.update({
      where: { id: current.id },
      data: {
        status,
        ...(hasShipment ? { fulfillmentCarrier: fulfillmentCarrier || null, trackingCode: trackingCode || null } : {})
      }
    });
    return { current } as const;
  });
  if ("error" in update) redirect(orderDetailFeedbackPath(detailPath, "error", update.error || "", returnTo));

  const nextCanceled = status === "CANCELED";
  if (nextCanceled !== (update.current.status === "CANCELED")) {
    await recordCreatedOrderProductMetrics(update.current.id, nextCanceled ? -1 : 1).catch(() => undefined);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  revalidatePath(detailPath);
  revalidatePath(`/pedido/${encodeURIComponent(orderNumber)}`);
  if (formData.get("detail") === "1") redirect(orderDetailFeedbackPath(detailPath, "saved", "1", returnTo));
}

export async function confirmManualOrderPaymentAction(formData: FormData) {
  const orderNumber = String(formData.get("orderNumber") || "").trim();
  const detailPath = `/admin/pedidos/${encodeURIComponent(orderNumber)}`;
  const returnTo = formData.get("returnTo");
  await requireAdmin(orderNumber ? orderDetailLoginReturnPath(detailPath, returnTo) : "/admin/pedidos");
  if (!orderNumber) redirect("/admin/pedidos?error=1");

  try {
    await markOrderPaid(orderNumber, { source: "manual" });
  } catch (error) {
    const message = error instanceof OrderError ? error.message : "Não foi possível confirmar o recebimento.";
    redirect(orderDetailFeedbackPath(detailPath, "error", message, returnTo));
  }

  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/pagamentos");
  revalidatePath(detailPath);
  revalidatePath(`/pedido/${encodeURIComponent(orderNumber)}`);
  revalidatePath(`/pagamento-simulado/${encodeURIComponent(orderNumber)}`);
  redirect(orderDetailFeedbackPath(detailPath, "saved", "1", returnTo));
}
