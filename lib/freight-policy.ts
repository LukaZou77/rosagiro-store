export const separateFreightNotice =
  "O pagamento no site inclui somente os produtos. O frete não está incluído: será calculado conforme o peso e as dimensões reais do pacote e cobrado separadamente pelo atendimento, fora do site, após sua aprovação.";

export const separateFreightStatus = "SEPARATE_PAYMENT";

export function isSeparateFreight(order: { shippingQuoteStatus: string }) {
  return order.shippingQuoteStatus === separateFreightStatus;
}

export function hasAcceptedSeparateFreight(value: unknown): value is true {
  return value === true;
}

// Zero is the amount collected for freight on the website, not a free-delivery quote.
// Existing orders retain their original shipping amount and payment total.
export function separateFreightForOrder(acceptedAt = new Date()) {
  return {
    method: "PADRAO" as const,
    shippingCents: 0,
    carrier: null,
    service: null,
    serviceLabel: "Entrega com frete cobrado separadamente",
    rateId: null,
    zone: null,
    city: null,
    weightGrams: 0,
    estimate: "Prazo a combinar com o atendimento",
    status: separateFreightStatus,
    message: separateFreightNotice,
    snapshot: {
      policyVersion: "separate-freight-2026-09-25",
      method: "PADRAO",
      chargeMode: "OUTSIDE_WEBSITE",
      freightAmountCents: null,
      collectedOnWebsiteCents: 0,
      customerAccepted: true,
      acceptedAt: acceptedAt.toISOString(),
      requiresFreightApproval: true,
      notice: separateFreightNotice
    }
  };
}
