import { NextResponse } from "next/server";
import { hasOrderRequestAccess } from "@/lib/order-access";
import { sameOriginRequest } from "@/lib/order-access-core";
import { OrderError, simulatePayment } from "@/lib/orders";
import { simulatedPaymentEnabled } from "@/lib/payments";

type RouteContext = {
  params: Promise<{ orderNumber: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  if (!simulatedPaymentEnabled()) {
    return NextResponse.json({ error: "Pagamento simulado não está disponível neste ambiente." }, { status: 403 });
  }
  const { orderNumber } = await context.params;
  if (!sameOriginRequest(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }
  if (!(await hasOrderRequestAccess(request, orderNumber))) {
    return NextResponse.json({ error: "Acesso ao pedido não autorizado." }, { status: 403 });
  }
  try {
    await simulatePayment(orderNumber);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Não foi possível confirmar o pagamento." }, { status: 500 });
  }
}
