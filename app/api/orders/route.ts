import { NextResponse } from "next/server";
import { checkoutAttemptFromPayload, CheckoutAttemptError, CheckoutRejectedError } from "@/lib/checkout-attempt";
import { findCheckoutOrder } from "@/lib/checkout-idempotency";
import { initializeCheckoutPayment } from "@/lib/checkout-payment";
import { assertPaymentCanStart, MercadoPagoError } from "@/lib/mercado-pago";
import { assertOrderAccessConfigured, setOrderAccessCookie } from "@/lib/order-access";
import { sameOriginRequest } from "@/lib/order-access-core";
import { createOrder, OrderError, parseCheckoutPayload } from "@/lib/orders";

export async function POST(request: Request) {
  let persistenceStarted = false;
  try {
    if (!sameOriginRequest(request.url, request.headers.get("origin"))) {
      return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
    }
    assertOrderAccessConfigured();
    let payload: unknown;
    try { payload = await request.json(); }
    catch { return NextResponse.json({ error: "Não foi possível ler o pedido. Atualize o checkout." }, { status: 400 }); }
    const attempt = checkoutAttemptFromPayload(payload);
    // Recover before checking changed stock, prices or gateway configuration.
    let order = await findCheckoutOrder(attempt);
    if (!order) {
      const input = parseCheckoutPayload(payload);
      assertPaymentCanStart(input.paymentMethod);
      persistenceStarted = true;
      order = await createOrder(input, attempt);
    }
    const result = await initializeCheckoutPayment(order.orderNumber);
    const response = NextResponse.json(result, { status: "paymentPending" in result ? 202 : 200 });
    return setOrderAccessCookie(response, order.orderNumber);
  } catch (error) {
    if (error instanceof CheckoutRejectedError) {
      return NextResponse.json({ error: error.message, orderCreated: false }, { status: error.status });
    }
    if (error instanceof CheckoutAttemptError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof OrderError || error instanceof MercadoPagoError) {
      // Configuration can differ across deployments serving the same attempt.
      // Only deterministic input rejection permits replacing its identity.
      const definitelyRejected = error instanceof OrderError && !persistenceStarted;
      return NextResponse.json({ error: error.message, ...(definitelyRejected ? { orderCreated: false } : {}) }, { status: error.status });
    }
    return NextResponse.json({ error: "Não foi possível confirmar o resultado. Verifique esta tentativa novamente; seu carrinho foi mantido." }, { status: 500 });
  }
}
