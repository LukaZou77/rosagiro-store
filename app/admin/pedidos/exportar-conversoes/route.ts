import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function brazilConversionTime(value: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(value);
  return `${parts}-03:00`;
}

export async function GET() {
  await requireAdmin();
  const conversionName = process.env.GOOGLE_ADS_OFFLINE_CONVERSION_NAME || "Pedido pago RosaGiro";
  const orders = await prisma.order.findMany({
    where: {
      status: "PAID",
      gclid: { not: null },
      payment: { paidAt: { not: null } }
    },
    include: { payment: true },
    orderBy: { createdAt: "desc" }
  });

  const lines = [
    ["Google Click ID", "Conversion Name", "Conversion Time", "Conversion Value", "Conversion Currency", "Order ID"].map(csvCell).join(","),
    ...orders.map((order) =>
      [
        order.gclid,
        conversionName,
        brazilConversionTime(order.payment?.paidAt || order.updatedAt),
        (order.totalCents / 100).toFixed(2),
        "BRL",
        order.orderNumber
      ]
        .map(csvCell)
        .join(",")
    )
  ];

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=rosagiro-google-ads-paid-orders.csv",
      "Cache-Control": "no-store"
    }
  });
}
