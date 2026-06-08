export const paymentMethods = [
  {
    value: "PIX",
    label: "Pix",
    description: "Crie o pedido e use os dados Pix exibidos para enviar o comprovante pelo WhatsApp."
  },
  {
    value: "CREDIT_CARD",
    label: "Cartão de crédito",
    description: "Pagamento por checkout seguro; a RosaGiro não armazena dados do cartão."
  },
  {
    value: "SIMULATED",
    label: "Confirmar com atendimento",
    description: "Use quando preferir que a equipe confirme estoque, entrega e condições pelo WhatsApp."
  }
] as const;

export type PaymentMethodValue = (typeof paymentMethods)[number]["value"];

export function isPaymentMethod(value: string): value is PaymentMethodValue {
  return paymentMethods.some((method) => method.value === value);
}

export function paymentMethodLabel(value?: string | null) {
  return paymentMethods.find((method) => method.value === value)?.label || "Confirmar com atendimento";
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
