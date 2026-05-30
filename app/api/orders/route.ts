import { NextResponse } from "next/server";
import { createOrder, OrderError, parseCheckoutPayload } from "@/lib/orders";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const input = parseCheckoutPayload(payload);
    const order = await createOrder(input);
    return NextResponse.json({
      orderNumber: order.orderNumber,
      redirectTo: `/pagamento-simulado/${order.orderNumber}`
    });
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Nao foi possivel criar o pedido." }, { status: 500 });
  }
}
