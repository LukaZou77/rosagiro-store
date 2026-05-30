export const paymentMethods = [
  {
    value: "PIX",
    label: "Pix",
    description: "Preparado para pagamento instantaneo no Brasil; nesta versao confirma pelo simulador."
  },
  {
    value: "CREDIT_CARD",
    label: "Cartao de credito",
    description: "Espaco reservado para cartao via Mercado Pago; sem cobranca real nesta fase."
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
