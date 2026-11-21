export const mercadoPagoInstallmentOptions = [3, 6, 9, 12] as const;
export type MercadoPagoInstallments = (typeof mercadoPagoInstallmentOptions)[number];
export const defaultMercadoPagoInstallments: MercadoPagoInstallments = 6;

export const paymentModeValues = ["manual", "simulated", "mercado_pago_sandbox", "mercado_pago_live"] as const;
export type PaymentMode = (typeof paymentModeValues)[number];
export type MercadoPagoMode = Extract<PaymentMode, `mercado_pago_${string}`>;
type PaymentRuntimeEnv = Partial<Pick<NodeJS.ProcessEnv,
  "NODE_ENV" | "PAYMENT_MODE" | "ENABLE_SIMULATED_PAYMENTS" | "VERCEL_ENV" | "VERCEL_TARGET_ENV"
>>;

export const simulatedPaymentPendingStatus = "test_simulation_pending";
export const simulatedPaymentConfirmedStatus = "test_simulation_confirmed";

export const storefrontPaymentLabel = "Pix, cartão de crédito com parcelamento e transferência bancária";
export const storefrontPaymentNote = "Aceitamos Pix e cartão de crédito com parcelamento pelo Mercado Pago. As parcelas disponíveis, os valores, as taxas e a aprovação são exibidos na página de pagamento. Para transferência bancária, confirme os dados com o atendimento pelo WhatsApp. Confirme a disponibilidade dos produtos antes de pagar.";

const basePaymentMethods = [
  {
    value: "PIX",
    label: "Pix",
    description: "Pague pelo Mercado Pago após confirmar a disponibilidade dos produtos."
  },
  {
    value: "CREDIT_CARD",
    label: "Cartão de crédito",
    description: "Pague à vista ou parcele pelo Mercado Pago. Confira as parcelas disponíveis, os valores e as taxas na página de pagamento."
  },
  {
    value: "SIMULATED",
    label: "Confirmar com atendimento",
    description: "Para transferência bancária, solicite os dados de pagamento pelo WhatsApp após a confirmação do estoque."
  }
] as const;

export type PaymentMethodValue = (typeof basePaymentMethods)[number]["value"];

export function normalizePaymentMode(value: unknown): PaymentMode {
  const cleaned = String(value || "").trim();
  return paymentModeValues.includes(cleaned as PaymentMode) ? (cleaned as PaymentMode) : "manual";
}

export function isPaymentModeValue(value: unknown): value is PaymentMode {
  const cleaned = String(value || "").trim();
  return paymentModeValues.includes(cleaned as PaymentMode);
}

export function isMercadoPagoMode(value: unknown): value is MercadoPagoMode {
  return value === "mercado_pago_sandbox" || value === "mercado_pago_live";
}

export function isProductionPaymentEnvironment(env: PaymentRuntimeEnv = process.env) {
  if (env.VERCEL_ENV === "production" || env.VERCEL_TARGET_ENV === "production") return true;
  if (env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development") return false;
  return env.NODE_ENV === "production";
}

export function simulatedPaymentEnabled(env: PaymentRuntimeEnv = process.env) {
  if (isProductionPaymentEnvironment(env) || env.ENABLE_SIMULATED_PAYMENTS !== "true") return false;
  const nonProductionEnvironment = env.VERCEL_ENV
    ? env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development"
    : env.NODE_ENV === "development" || env.NODE_ENV === "test";
  const mode = normalizePaymentMode(env.PAYMENT_MODE);
  return nonProductionEnvironment && (mode === "simulated" || mode === "mercado_pago_sandbox");
}

export function paymentModeForEnvironment(env: PaymentRuntimeEnv = process.env): PaymentMode {
  const mode = normalizePaymentMode(env.PAYMENT_MODE);
  if (mode === "simulated" && !simulatedPaymentEnabled(env)) return "manual";
  if (mode === "mercado_pago_sandbox" && isProductionPaymentEnvironment(env)) return "manual";
  return mode;
}

export function canConfirmSimulatedPayment(payment: {
  provider: string;
  method: string;
  providerStatus: string | null;
} | null | undefined) {
  return payment?.provider === "SIMULATED" && payment.method === "SIMULATED" &&
    (payment.providerStatus === simulatedPaymentPendingStatus || payment.providerStatus === simulatedPaymentConfirmedStatus);
}

export function canConfirmManualPayment(payment: {
  provider: string;
  method: string;
  providerStatus: string | null;
} | null | undefined) {
  return payment?.provider === "SIMULATED" &&
    (payment.method === "PIX" || payment.method === "SIMULATED") &&
    payment.providerStatus !== simulatedPaymentPendingStatus;
}

export function isPaymentConfirmed(
  paymentStatus: string | null | undefined,
  paidAt: Date | string | null | undefined,
  providerStatus?: string | null
) {
  return paymentStatus === "PAID" && Boolean(paidAt) && providerStatus !== simulatedPaymentConfirmedStatus;
}

export function isMercadoPagoInstallments(value: unknown): value is MercadoPagoInstallments {
  const parsed = Number(value);
  return mercadoPagoInstallmentOptions.includes(parsed as MercadoPagoInstallments);
}

export function normalizeMercadoPagoInstallments(value: unknown, fallback: MercadoPagoInstallments = defaultMercadoPagoInstallments) {
  const parsed = Number(value);
  return isMercadoPagoInstallments(parsed) ? parsed : fallback;
}

export function paymentMethodsForCheckout(options: { testPayments?: boolean; allowCreditCard?: boolean } = {}) {
  const methods = basePaymentMethods.filter((method) => options.allowCreditCard !== false || method.value !== "CREDIT_CARD");
  if (!options.testPayments) return methods;
  return [
    ...methods.filter((method) => method.value !== "SIMULATED"),
    { value: "SIMULATED", label: "Pagamento de teste", description: "Simule a confirmação em um ambiente de teste." }
  ] as const;
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
