import { NextResponse } from "next/server";
import { MercadoPagoError, startOrderPayment } from "@/lib/mercado-pago";
import { createOrder, OrderError, parseCheckoutPayload } from "@/lib/orders";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const input = parseCheckoutPayload(payload);
    const order = await createOrder(input);
    const payment = await startOrderPayment(order.orderNumber);
    return NextResponse.json({
      orderNumber: order.orderNumber,
      redirectTo: payment.redirectTo,
      paymentProvider: payment.provider,
      externalRedirect: payment.external
    });
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof MercadoPagoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Não foi possível criar o pedido." }, { status: 500 });
  }
}
