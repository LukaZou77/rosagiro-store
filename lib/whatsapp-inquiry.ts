const WHATSAPP_HOSTS = new Set(["wa.me", "api.whatsapp.com", "web.whatsapp.com"]);
const INQUIRY_REFERENCE_PREFIX = "RGWA-";
const INQUIRY_REFERENCE_LINE = /(?:^|\n)Refer[eê]ncia do atendimento:\s*(RGWA-[A-Z0-9_-]{12,96})(?=\s|$)/i;
export const WHATSAPP_CLICK_ANALYTICS_EVENT = "whatsapp_click";

export type WhatsAppLeadStatusValue = "QUALIFIED" | "WON" | "LOST";

export function normalizeWhatsAppInquiryReference(value: unknown) {
  const reference = String(value || "").trim();
  return /^RGWA-[A-Z0-9_-]{12,96}$/.test(reference) ? reference : null;
}

export function whatsAppInquiryReferenceUpdateIntent(input: {
  existingReference: string | null;
  fieldPresent: boolean;
  submittedValue: unknown;
}) {
  const submittedReference = String(input.submittedValue || "").trim();
  if (!input.fieldPresent || !submittedReference || submittedReference === input.existingReference) {
    return { reference: input.existingReference, changed: false, invalid: false } as const;
  }

  const reference = normalizeWhatsAppInquiryReference(submittedReference);
  if (!reference) return { reference: null, changed: true, invalid: true } as const;
  return { reference, changed: true, invalid: false } as const;
}

export function whatsAppInquiryReference(eventId: string) {
  const normalizedEventId = String(eventId || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{12,96}$/.test(normalizedEventId)) return null;
  return `${INQUIRY_REFERENCE_PREFIX}${normalizedEventId}`;
}

function existingInquiryReference(text: string) {
  return normalizeWhatsAppInquiryReference(INQUIRY_REFERENCE_LINE.exec(text)?.[1]?.toUpperCase());
}

export function prepareWhatsAppInquiryHref(href: string, proposedEventId: string) {
  try {
    const url = new URL(href);
    if (!WHATSAPP_HOSTS.has(url.hostname.toLowerCase())) return null;

    const currentText = url.searchParams.get("text") || "";
    const existingReference = existingInquiryReference(currentText);
    const inquiryReference = existingReference || whatsAppInquiryReference(proposedEventId);
    if (!inquiryReference) return null;

    if (!existingReference) {
      const separator = currentText.trim() ? "\n\n" : "";
      url.searchParams.set("text", `${currentText}${separator}Referência do atendimento: ${inquiryReference}`);
    }

    return {
      href: url.toString(),
      eventId: inquiryReference.slice(INQUIRY_REFERENCE_PREFIX.length),
      inquiryReference
    };
  } catch {
    return null;
  }
}

export function whatsAppAnalyticsDestination(href: string) {
  try {
    const url = new URL(href);
    const hostname = url.hostname.toLowerCase();
    if (!WHATSAPP_HOSTS.has(hostname)) return null;
    const pathClassification = hostname === "wa.me" ? "direct" : "send";
    return {
      label: `${hostname}/${pathClassification}`,
      linkUrl: `https://${hostname}/${pathClassification}`
    };
  } catch {
    return null;
  }
}

export function whatsAppInternalTrackingPath(pathname: string) {
  const path = String(pathname || "").split(/[?#]/, 1)[0].replace(/\/{2,}/g, "/");
  const lowerPath = path.toLowerCase();
  if (!path.startsWith("/") || lowerPath === "/admin" || lowerPath.startsWith("/admin/")) return null;
  if (lowerPath === "/api" || lowerPath.startsWith("/api/")) return null;
  if (lowerPath.startsWith("/pedido/")) return "/pedido/[orderNumber]";
  if (lowerPath.startsWith("/pagamento-simulado/")) return "/pagamento-simulado/[orderNumber]";
  return path;
}

export type WhatsAppOrderLinkError =
  | "PHONE_MISMATCH"
  | "WON_REQUIRES_ORDER"
  | "WON_REQUIRES_PAID_ORDER";

export function whatsAppOrderLinkError(input: {
  leadWhatsappDigits: string;
  orderWhatsappDigits?: string | null;
  requestedStatus: WhatsAppLeadStatusValue;
  hasOrder: boolean;
  paymentStatus?: string | null;
  paidAt?: Date | null;
}): WhatsAppOrderLinkError | null {
  if (input.hasOrder && input.leadWhatsappDigits !== input.orderWhatsappDigits) return "PHONE_MISMATCH";
  if (input.requestedStatus !== "WON") return null;
  if (!input.hasOrder) return "WON_REQUIRES_ORDER";
  if (input.paymentStatus !== "PAID" || !input.paidAt) return "WON_REQUIRES_PAID_ORDER";
  return null;
}

export function paidLinkedOrderSummary(
  leads: Array<{
    orderId: string | null;
    orderPayment: { status: string; paidAt: Date | null; amountCents: number } | null;
  }>
) {
  const paidOrderIds = new Set<string>();
  let revenueCents = 0;
  for (const lead of leads) {
    if (!lead.orderId || paidOrderIds.has(lead.orderId)) continue;
    if (lead.orderPayment?.status !== "PAID" || !lead.orderPayment.paidAt) continue;
    paidOrderIds.add(lead.orderId);
    revenueCents += lead.orderPayment.amountCents;
  }
  return { orderCount: paidOrderIds.size, revenueCents };
}
