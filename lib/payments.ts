export const mercadoPagoInstallmentOptions = [3, 6, 9, 12] as const;
export type MercadoPagoInstallments = (typeof mercadoPagoInstallmentOptions)[number];
export const defaultMercadoPagoInstallments: MercadoPagoInstallments = 6;

export const paymentModeValues = ["simulated", "mercado_pago_sandbox", "mercado_pago_live"] as const;
export type PaymentMode = (typeof paymentModeValues)[number];

const basePaymentMethods = [
  {
    value: "PIX",
    label: "Pix",
    description: "Pagamento seguro pelo Mercado Pago."
  },
  {
    value: "CREDIT_CARD",
    label: "Cartão de crédito",
    description: "Pagamento seguro pelo Mercado Pago; a RosaGiro não armazena dados do cartão."
  },
  {
    value: "SIMULATED",
    label: "Confirmar com atendimento",
    description: "Use quando preferir que a equipe confirme estoque, entrega e condições pelo WhatsApp."
  }
] as const;

export type PaymentMethodValue = (typeof basePaymentMethods)[number]["value"];

export function normalizePaymentMode(value: unknown): PaymentMode {
  const cleaned = String(value || "").trim();
  return paymentModeValues.includes(cleaned as PaymentMode) ? (cleaned as PaymentMode) : "simulated";
}

export function isPaymentModeValue(value: unknown): value is PaymentMode {
  const cleaned = String(value || "").trim();
  return paymentModeValues.includes(cleaned as PaymentMode);
}

export function isMercadoPagoMode(value: unknown) {
  const mode = normalizePaymentMode(value);
  return mode === "mercado_pago_sandbox" || mode === "mercado_pago_live";
}

export function paymentModeAllowsSimulated(value: unknown) {
  const cleaned = String(value || "").trim();
  if (!cleaned) return true;
  return cleaned === "simulated" || cleaned === "mercado_pago_sandbox";
}

export function isMercadoPagoInstallments(value: unknown): value is MercadoPagoInstallments {
  const parsed = Number(value);
  return mercadoPagoInstallmentOptions.includes(parsed as MercadoPagoInstallments);
}

export function normalizeMercadoPagoInstallments(value: unknown, fallback: MercadoPagoInstallments = defaultMercadoPagoInstallments) {
  const parsed = Number(value);
  return isMercadoPagoInstallments(parsed) ? parsed : fallback;
}

export function creditCardInstallmentLabel(maxInstallments: unknown) {
  return `Cartão de crédito em até ${normalizeMercadoPagoInstallments(maxInstallments)}x`;
}

export function paymentMethodsForCheckout(
  maxInstallments: unknown = defaultMercadoPagoInstallments,
  options: { includeSimulated?: boolean } = {}
) {
  const installmentLabel = creditCardInstallmentLabel(maxInstallments);
  return basePaymentMethods
    .filter((method) => options.includeSimulated !== false || method.value !== "SIMULATED")
    .map((method) =>
      method.value === "CREDIT_CARD"
        ? {
            ...method,
            label: installmentLabel
          }
        : method
    );
}

export const paymentMethods = paymentMethodsForCheckout();

export function isPaymentMethod(value: string): value is PaymentMethodValue {
  return basePaymentMethods.some((method) => method.value === value);
}

export function paymentMethodLabel(value?: string | null) {
  if (value === "PIX") return "Pix";
  if (value === "CREDIT_CARD") return "Cartão de crédito";
  return "Confirmar com atendimento";
}

export function paymentProviderLabel(value?: string | null) {
  if (value === "MERCADO_PAGO") return "Mercado Pago";
  return "Atendimento";
}

export function paymentStatusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    PENDING: "Aguardando pagamento",
    PAID: "Pago",
    FAILED: "Falhou"
  };
  return labels[value || ""] || "Aguardando pagamento";
}

export function mercadoPagoReturnMessage(value?: string | null) {
  const labels: Record<string, string> = {
    success: "Retorno recebido. A confirmação final aparece quando o pagamento for aprovado.",
    pending: "Pagamento em análise. Vamos manter o pedido aguardando confirmação.",
    failure: "O pagamento indicou falha ou cancelamento. Você pode tentar novamente ou falar com o atendimento."
  };
  return labels[value || ""] || "";
}
