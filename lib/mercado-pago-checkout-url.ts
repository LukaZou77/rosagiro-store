import type { MercadoPagoMode, PaymentMode } from "@/lib/payments";

const liveOrigins = new Set(["https://www.mercadopago.com.br", "https://www.mercadopago.com"]);
const sandboxOrigins = new Set(["https://sandbox.mercadopago.com.br", "https://sandbox.mercadopago.com"]);

export function mercadoPagoCheckoutUrl(value: string | null, mode?: MercadoPagoMode) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    const live = mode !== "mercado_pago_sandbox" && liveOrigins.has(url.origin);
    const sandbox = mode !== "mercado_pago_live" && sandboxOrigins.has(url.origin);
    return live || sandbox ? url : null;
  } catch {
    return null;
  }
}

type OrderWithSavedPreference = {
  status: string;
  payment: {
    provider: string;
    status: string;
    paidAt: Date | null;
    providerPreferenceId: string | null;
    providerInitPoint: string | null;
    providerSandboxInitPoint: string | null;
  } | null;
};

export function mercadoPagoPaymentAwaiting(order: OrderWithSavedPreference) {
  return order.status === "PENDING_PAYMENT" && order.payment?.provider === "MERCADO_PAGO" &&
    order.payment.status !== "PAID" && !order.payment.paidAt;
}

export function savedMercadoPagoCheckoutUrl(order: OrderWithSavedPreference, mode: PaymentMode) {
  const payment = order.payment;
  if (!mercadoPagoPaymentAwaiting(order) || !payment?.providerPreferenceId) return null;
  if (mode === "mercado_pago_live") return mercadoPagoCheckoutUrl(payment.providerInitPoint, mode);
  if (mode === "mercado_pago_sandbox") return mercadoPagoCheckoutUrl(payment.providerSandboxInitPoint, mode);
  return null;
}
