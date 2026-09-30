"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordCreatedOrderProductMetrics } from "@/lib/product-daily-metrics";

const statuses = ["PENDING_PAYMENT", "PAID", "FULFILLING", "SHIPPED", "CANCELED"] as const;

export async function updateOrderStatusAction(formData: FormData) {
  const orderNumber = String(formData.get("orderNumber") || "").trim();
  const detailPath = `/admin/pedidos/${encodeURIComponent(orderNumber)}`;
  await requireAdmin(orderNumber ? detailPath : "/admin/pedidos");

  const status = String(formData.get("status") || "");
  if (!orderNumber || !statuses.includes(status as (typeof statuses)[number])) {
    redirect("/admin/pedidos?error=1");
  }
  const hasShipment = formData.has("fulfillmentCarrier") || formData.has("trackingCode");
  const fulfillmentCarrier = String(formData.get("fulfillmentCarrier") || "").trim();
  const trackingCode = String(formData.get("trackingCode") || "").trim();
  if (hasShipment && (Boolean(fulfillmentCarrier) !== Boolean(trackingCode) || fulfillmentCarrier.length > 100 || trackingCode.length > 120)) {
    redirect(`${detailPath}?error=${encodeURIComponent("Preencha a transportadora e o código de rastreio. / 请同时填写快递公司和物流单号。")}`);
  }

  const currentOrder = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true, status: true } });
  if (!currentOrder) redirect("/admin/pedidos?error=1");
  await prisma.order.update({
    where: { orderNumber },
    data: {
      status: status as (typeof statuses)[number],
      ...(hasShipment ? { fulfillmentCarrier: fulfillmentCarrier || null, trackingCode: trackingCode || null } : {})
    }
  });

  const nextCanceled = status === "CANCELED";
  if (nextCanceled !== (currentOrder.status === "CANCELED")) {
    await recordCreatedOrderProductMetrics(currentOrder.id, nextCanceled ? -1 : 1).catch(() => undefined);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  revalidatePath(detailPath);
  revalidatePath(`/pedido/${encodeURIComponent(orderNumber)}`);
  if (formData.get("detail") === "1") redirect(`${detailPath}?saved=1`);
}
