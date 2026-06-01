export const paymentMethods = [
  {
    value: "PIX",
    label: "Pix",
    description: "No sandbox Mercado Pago abre o Checkout Pro; sem token local, segue pelo simulador."
  },
  {
    value: "CREDIT_CARD",
    label: "Cartao de credito",
    description: "Checkout Pro sandbox para testes; dados reais de cartao nao sao coletados no site."
  },
  {
    value: "SIMULATED",
    label: "Pagamento simulado",
    description: "Ambiente de teste para validar pedido, estoque e pos-compra."
  }
] as const;

export type PaymentMethodValue = (typeof paymentMethods)[number]["value"];

export function isPaymentMethod(value: string): value is PaymentMethodValue {
  return paymentMethods.some((method) => method.value === value);
}

export function paymentMethodLabel(value?: string | null) {
  return paymentMethods.find((method) => method.value === value)?.label || "Pagamento simulado";
}

export function paymentProviderLabel(value?: string | null) {
  if (value === "MERCADO_PAGO") return "Mercado Pago";
  return "Simulado";
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
    success: "Retorno recebido do Mercado Pago. A confirmacao final depende do webhook aprovado.",
    pending: "Pagamento em analise no Mercado Pago. Vamos manter o pedido aguardando confirmacao.",
    failure: "O Mercado Pago indicou falha ou cancelamento. Voce pode tentar novamente ou falar com o atendimento."
  };
  return labels[value || ""] || "";
}
