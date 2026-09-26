import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  normalizeWhatsAppInquiryReference,
  paidLinkedOrderSummary,
  prepareWhatsAppInquiryHref,
  WHATSAPP_CLICK_ANALYTICS_EVENT,
  whatsAppAnalyticsDestination,
  whatsAppInquiryReferenceUpdateIntent,
  whatsAppInternalTrackingPath,
  whatsAppOrderLinkError
} from "@/lib/whatsapp-inquiry";

const EVENT_ID = "0123456789ABCDEF0123456789ABCDEF";

test("appends one non-PII inquiry reference and keeps it stable", () => {
  const first = prepareWhatsAppInquiryHref("https://wa.me/5511999999999?text=Ol%C3%A1", EVENT_ID);
  assert.ok(first);
  assert.equal(first.inquiryReference, `RGWA-${EVENT_ID}`);
  assert.equal(new URL(first.href).searchParams.get("text"), `Olá\n\nReferência do atendimento: RGWA-${EVENT_ID}`);

  const repeated = prepareWhatsAppInquiryHref(first.href, "AAAAAAAAAAAABBBBBBBBBBBB");
  assert.deepEqual(repeated, first);
});

test("rejects invalid references and non-WhatsApp destinations", () => {
  assert.equal(normalizeWhatsAppInquiryReference("rgwa-lowercase123456"), null);
  assert.equal(prepareWhatsAppInquiryHref("https://example.com/?text=oi", EVENT_ID), null);
});

test("lead updates retain persisted inquiry attribution unless a new exact reference is submitted", () => {
  const existingReference = `RGWA-${EVENT_ID}`;
  assert.deepEqual(
    whatsAppInquiryReferenceUpdateIntent({ existingReference, fieldPresent: false, submittedValue: null }),
    { reference: existingReference, changed: false, invalid: false }
  );
  assert.deepEqual(
    whatsAppInquiryReferenceUpdateIntent({ existingReference, fieldPresent: true, submittedValue: "" }),
    { reference: existingReference, changed: false, invalid: false }
  );
  assert.deepEqual(
    whatsAppInquiryReferenceUpdateIntent({ existingReference, fieldPresent: true, submittedValue: existingReference }),
    { reference: existingReference, changed: false, invalid: false }
  );
  assert.deepEqual(
    whatsAppInquiryReferenceUpdateIntent({
      existingReference,
      fieldPresent: true,
      submittedValue: "RGWA-AAAAAAAAAAAABBBBBBBBBBBB"
    }),
    { reference: "RGWA-AAAAAAAAAAAABBBBBBBBBBBB", changed: true, invalid: false }
  );
});

test("update action preserves snapshots when the retained click event has expired", () => {
  const actions = readFileSync(new URL("../app/admin/actions.ts", import.meta.url), "utf8");
  const start = actions.indexOf("export async function updateWhatsAppLeadStatusAction");
  const end = actions.indexOf("export async function updateOrderStatusAction", start);
  const updateAction = actions.slice(start, end);

  assert.match(updateAction, /inquiryReference: true/);
  assert.match(updateAction, /clickPathSnapshot: true/);
  assert.match(updateAction, /!clickEvent && referenceIntent\.changed/);
  assert.match(updateAction, /clickEvent \? clickEvent\.occurredAt : lead\.clickOccurredAt/);
  assert.match(updateAction, /clickEvent \? clickEvent\.utmCampaign : lead\.clickUtmCampaign/);
});

test("analytics destination contains no phone or query content", () => {
  assert.equal(WHATSAPP_CLICK_ANALYTICS_EVENT, "whatsapp_click");
  assert.deepEqual(
    whatsAppAnalyticsDestination("https://wa.me/5511999999999?text=CPF+123"),
    { label: "wa.me/direct", linkUrl: "https://wa.me/direct" }
  );
  assert.deepEqual(
    whatsAppAnalyticsDestination("https://api.whatsapp.com/send?phone=5511999999999&text=segredo"),
    { label: "api.whatsapp.com/send", linkUrl: "https://api.whatsapp.com/send" }
  );
});

test("internal click paths exclude admin APIs and mask order identifiers", () => {
  assert.equal(whatsAppInternalTrackingPath("/admin/leads"), null);
  assert.equal(whatsAppInternalTrackingPath("/api/orders/RG-secret"), null);
  assert.equal(whatsAppInternalTrackingPath("/pedido/RG-123456?token=secret"), "/pedido/[orderNumber]");
  assert.equal(
    whatsAppInternalTrackingPath("/pagamento-simulado/RG-123456"),
    "/pagamento-simulado/[orderNumber]"
  );
  assert.equal(whatsAppInternalTrackingPath("/produto/batom?cpf=123"), "/produto/batom");
});

test("WON requires a matching phone and confirmed paid order", () => {
  assert.equal(
    whatsAppOrderLinkError({
      leadWhatsappDigits: "5511999999999",
      hasOrder: false,
      requestedStatus: "WON"
    }),
    "WON_REQUIRES_ORDER"
  );
  assert.equal(
    whatsAppOrderLinkError({
      leadWhatsappDigits: "5511999999999",
      orderWhatsappDigits: "5511888888888",
      hasOrder: true,
      requestedStatus: "QUALIFIED"
    }),
    "PHONE_MISMATCH"
  );
  assert.equal(
    whatsAppOrderLinkError({
      leadWhatsappDigits: "5511999999999",
      orderWhatsappDigits: "5511999999999",
      hasOrder: true,
      requestedStatus: "WON",
      paymentStatus: "PENDING",
      paidAt: null
    }),
    "WON_REQUIRES_PAID_ORDER"
  );
  assert.equal(
    whatsAppOrderLinkError({
      leadWhatsappDigits: "5511999999999",
      orderWhatsappDigits: "5511999999999",
      hasOrder: true,
      requestedStatus: "WON",
      paymentStatus: "PAID",
      paidAt: new Date("2026-09-26T12:00:00Z")
    }),
    null
  );
});

test("paid linked revenue is distinct from raw lead rows", () => {
  const paidAt = new Date("2026-09-26T12:00:00Z");
  assert.deepEqual(
    paidLinkedOrderSummary([
      { orderId: "order-1", orderPayment: { status: "PAID", paidAt, amountCents: 12990 } },
      { orderId: "order-1", orderPayment: { status: "PAID", paidAt, amountCents: 12990 } },
      { orderId: "order-2", orderPayment: { status: "PENDING", paidAt: null, amountCents: 9900 } }
    ]),
    { orderCount: 1, revenueCents: 12990 }
  );
});
