import { NextResponse } from "next/server";
import { assertPaymentCanStart, MercadoPagoError, startOrderPayment } from "@/lib/mercado-pago";
import { assertOrderAccessConfigured, setOrderAccessCookie } from "@/lib/order-access";
import { createOrder, OrderError, parseCheckoutPayload } from "@/lib/orders";

export async function POST(request: Request) {
  let createdOrderNumber: string | null = null;
  try {
    assertOrderAccessConfigured();
    const payload = await request.json();
    const input = parseCheckoutPayload(payload);
    assertPaymentCanStart(input.paymentMethod);
    const order = await createOrder(input);
    createdOrderNumber = order.orderNumber;
    const payment = await startOrderPayment(order.orderNumber);
    const response = NextResponse.json({
      orderNumber: order.orderNumber,
      redirectTo: payment.redirectTo,
      paymentProvider: payment.provider,
      externalRedirect: payment.external
    });
    return setOrderAccessCookie(response, order.orderNumber);
  } catch (error) {
    let response: NextResponse;
    if (error instanceof OrderError) {
      response = NextResponse.json({ error: error.message }, { status: error.status });
    } else if (error instanceof MercadoPagoError) {
      response = NextResponse.json({ error: error.message }, { status: error.status });
    } else {
      console.error(error);
      response = NextResponse.json({ error: "Não foi possível criar o pedido." }, { status: 500 });
    }
    return createdOrderNumber ? setOrderAccessCookie(response, createdOrderNumber) : response;
  }
}
