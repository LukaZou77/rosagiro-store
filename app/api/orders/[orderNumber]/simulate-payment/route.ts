import { NextResponse } from "next/server";
import { OrderError, simulatePayment } from "@/lib/orders";

type RouteContext = {
  params: Promise<{ orderNumber: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { orderNumber } = await context.params;
  try {
    await simulatePayment(orderNumber);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Nao foi possivel confirmar o pagamento." }, { status: 500 });
  }
}
