import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { savedMercadoPagoCheckoutUrl } from "@/lib/mercado-pago-checkout-url";
import { hasOrderRequestAccess } from "@/lib/order-access";
import { paymentModeForEnvironment } from "@/lib/payments";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  if (!(await hasOrderRequestAccess(request, orderNumber))) {
    return NextResponse.json({ error: "Acesso ao pedido não autorizado." }, { status: 403, headers });
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      status: true,
      payment: {
        select: {
          status: true,
          paidAt: true,
          provider: true,
          providerPreferenceId: true,
          providerInitPoint: true,
          providerSandboxInitPoint: true
        }
      }
    }
  });
  const checkoutUrl = order && savedMercadoPagoCheckoutUrl(order, paymentModeForEnvironment());
  const trackingUrl = new URL(`/pedido/${encodeURIComponent(orderNumber)}`, request.url);
  return NextResponse.redirect(checkoutUrl || trackingUrl, { headers });
}
