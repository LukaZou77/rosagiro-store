import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { parseBrazilianDocument } from "@/lib/brazilian-document";
import { prisma } from "@/lib/db";
import { isSeparateFreight, separateFreightNotice } from "@/lib/freight-policy";
import { OrderError, markOrderPaid } from "@/lib/orders";
import { isMercadoPagoMode, paymentModeForEnvironment, type PaymentMethodValue, type MercadoPagoMode } from "@/lib/payments";
import { configuredMercadoPagoInstallments, getStoreProfile } from "@/lib/store-profile";
import type { Prisma } from "@/src/generated/prisma/client";

const MERCADO_PAGO_API_BASE = "https://api.mercadopago.com";

type PaymentStartResult = {
  orderNumber: string;
  redirectTo: string;
  provider: "SIMULATED" | "MERCADO_PAGO";
  external: boolean;
};

type MercadoPagoPreferenceResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
};

type MercadoPagoPaymentResponse = {
  id?: string | number;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  date_approved?: string | null;
  payment_method_id?: string;
  payment_type_id?: string;
};

type MercadoPagoWebhookPayload = {
  id?: string | number;
  type?: string;
  action?: string;
  live_mode?: boolean;
  data?: {
    id?: string | number;
  };
};

export class MercadoPagoError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function digits(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function centsToAmount(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function amountToCents(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || name,
    lastName: parts.slice(1).join(" ")
  };
}

function splitPhone(phone: string) {
  const onlyDigits = digits(phone);
  return {
    areaCode: onlyDigits.slice(0, 2),
    number: onlyDigits.slice(2)
  };
}

function siteUrl() {
  const raw = cleanText(process.env.NEXT_PUBLIC_SITE_URL).replace(/\/+$/, "");
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

export function shouldUseMercadoPago(method: PaymentMethodValue | string | null | undefined) {
  return method === "PIX" || method === "CREDIT_CARD";
}

function currentPaymentMode() {
  return paymentModeForEnvironment();
}

function unavailablePaymentMessage() {
  return "Pagamento temporariamente indisponível. Fale com o atendimento para finalizar seu pedido.";
}

export function mercadoPagoReady() {
  const mode = currentPaymentMode();
  return (
    isMercadoPagoMode(mode) &&
    Boolean(cleanText(process.env.MERCADO_PAGO_ACCESS_TOKEN)) &&
    Boolean(siteUrl()) &&
    (mode !== "mercado_pago_live" || Boolean(cleanText(process.env.MERCADO_PAGO_WEBHOOK_SECRET)))
  );
}

function mercadoPagoConfig(): { accessToken: string; publicUrl: string; mode: MercadoPagoMode } {
  const mode = currentPaymentMode();
  const accessToken = cleanText(process.env.MERCADO_PAGO_ACCESS_TOKEN);
  const publicUrl = siteUrl();
  const webhookSecret = cleanText(process.env.MERCADO_PAGO_WEBHOOK_SECRET);
  if (!isMercadoPagoMode(mode) || !accessToken || !publicUrl || (mode === "mercado_pago_live" && !webhookSecret)) {
    throw new MercadoPagoError(unavailablePaymentMessage(), 503);
  }
  return { accessToken, publicUrl, mode };
}

function localPaymentResult(orderNumber: string): PaymentStartResult {
  return {
    orderNumber,
    redirectTo: `/pagamento-simulado/${orderNumber}`,
    provider: "SIMULATED",
    external: false
  };
}

function canStartOrderPayment(order: {
  status: string;
  payment: { status: string; paidAt: Date | null } | null;
} | null) {
  return order?.status === "PENDING_PAYMENT" && order.payment !== null &&
    order.payment.status !== "PAID" && !order.payment.paidAt;
}

export function assertPaymentCanStart(method: PaymentMethodValue | string | null | undefined) {
  const mode = currentPaymentMode();
  if (!shouldUseMercadoPago(method) || !isMercadoPagoMode(mode)) return;
  if (!mercadoPagoReady()) {
    throw new MercadoPagoError(unavailablePaymentMessage(), 503);
  }
}

export async function startOrderPayment(orderNumber: string): Promise<PaymentStartResult> {
  const mode = currentPaymentMode();
  const orderQuery = {
    where: { orderNumber },
    include: { payment: true }
  } satisfies Prisma.OrderFindUniqueArgs;
  const order = await prisma.order.findUnique(orderQuery);
  if (!order || !order.payment) throw new MercadoPagoError("Pedido não encontrado.", 404);
  const orderResult: PaymentStartResult = {
    orderNumber,
    redirectTo: `/pedido/${encodeURIComponent(orderNumber)}`,
    provider: order.payment.provider,
    external: false
  };
  if (!canStartOrderPayment(order)) return orderResult;
  if (!shouldUseMercadoPago(order.payment.method) || !isMercadoPagoMode(mode)) {
    return localPaymentResult(order.orderNumber);
  }

  if (!mercadoPagoReady()) {
    throw new MercadoPagoError(unavailablePaymentMessage(), 503);
  }

  const existingRedirect =
    mode === "mercado_pago_sandbox"
      ? order.payment.providerSandboxInitPoint || order.payment.providerInitPoint
      : order.payment.providerInitPoint;
  if (order.payment.providerPreferenceId && existingRedirect) {
    return {
      orderNumber: order.orderNumber,
      redirectTo: existingRedirect,
      provider: "MERCADO_PAGO",
      external: true
    };
  }

  const config = mercadoPagoConfig();
  const payerName = splitName(order.customerName);
  const payerPhone = splitPhone(order.customerPhone);
  const payerDocument = parseBrazilianDocument(order.customerCpf);
  // Checkout Pro can collect identification itself. Its preference API does not document
  // alphanumeric CNPJ prefill, so include only validated numeric documents as prefill.
  const identification = payerDocument && (payerDocument.type === "CPF" || !payerDocument.alphanumeric)
    ? { type: payerDocument.type, number: payerDocument.number }
    : undefined;
  const baseOrderUrl = `${config.publicUrl}/pedido/${encodeURIComponent(order.orderNumber)}`;
  const maxInstallments = configuredMercadoPagoInstallments(await getStoreProfile());
  const preferenceBody = {
    items: [
      {
        id: order.orderNumber,
        title: `Pedido RosaGiro ${order.orderNumber}${isSeparateFreight(order) ? " - somente produtos, frete à parte" : ""}`,
        ...(isSeparateFreight(order) ? { description: separateFreightNotice } : {}),
        quantity: 1,
        currency_id: "BRL",
        unit_price: centsToAmount(order.totalCents)
      }
    ],
    payer: {
      name: payerName.firstName,
      surname: payerName.lastName,
      email: order.customerEmail,
      phone: {
        area_code: payerPhone.areaCode,
        number: payerPhone.number
      },
      identification,
      address: {
        zip_code: digits(order.cep),
        street_name: order.street,
        street_number: order.number
      }
    },
    payment_methods: {
      installments: maxInstallments
    },
    back_urls: {
      success: `${baseOrderUrl}?mp=success`,
      pending: `${baseOrderUrl}?mp=pending`,
      failure: `${baseOrderUrl}?mp=failure`
    },
    auto_return: "approved",
    notification_url: `${config.publicUrl}/api/webhooks/mercado-pago`,
    external_reference: order.orderNumber,
    statement_descriptor: "ROSAGIRO",
    metadata: {
      order_number: order.orderNumber,
      payment_method_requested: order.payment.method,
      max_installments: maxInstallments,
      ...(isSeparateFreight(order) ? { freight_charge_mode: "OUTSIDE_WEBSITE" } : {})
    }
  };

  // Recheck after preparing the preference, which can await other database reads.
  if (!canStartOrderPayment(await prisma.order.findUnique(orderQuery))) return orderResult;
  const response = await fetch(`${MERCADO_PAGO_API_BASE}/checkout/preferences`, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(preferenceBody)
  }).catch(async (error: unknown) => {
    if (!canStartOrderPayment(await prisma.order.findUnique(orderQuery))) return null;
    throw error;
  });
  if (!response) return orderResult;
  const payload = (await response.json().catch(() => ({}))) as MercadoPagoPreferenceResponse & Record<string, unknown>;
  const redirectTo =
    config.mode === "mercado_pago_sandbox"
      ? cleanText(payload.sandbox_init_point) || cleanText(payload.init_point)
      : cleanText(payload.init_point);
  const preferenceId = cleanText(payload.id);
  const preferenceError = !response.ok
    ? cleanText(payload.message) || "Não foi possível criar a preferência Mercado Pago."
    : !preferenceId || !redirectTo ? "Mercado Pago não retornou uma URL de checkout." : null;

  const saved = await prisma.$transaction(async (tx) => {
    // Settlement and administrative status changes acquire this same order lock.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE "orderNumber" = ${orderNumber} FOR UPDATE`;
    const current = await tx.order.findUnique(orderQuery);
    if (!current || !canStartOrderPayment(current)) return false;
    await tx.payment.update({
      where: { orderId: current.id },
      data: {
        provider: "MERCADO_PAGO",
        providerExternalReference: orderNumber,
        providerPayload: toJsonValue(payload),
        syncError: preferenceError,
        ...(!preferenceError ? {
          providerPreferenceId: preferenceId,
          providerInitPoint: cleanText(payload.init_point) || null,
          providerSandboxInitPoint: cleanText(payload.sandbox_init_point) || null,
          providerStatus: "preference_created",
          providerStatusDetail: null
        } : {})
      }
    });
    return true;
  });
  if (!saved || !canStartOrderPayment(await prisma.order.findUnique(orderQuery))) return orderResult;
  if (preferenceError) throw new MercadoPagoError(preferenceError);

  return {
    orderNumber,
    redirectTo,
    provider: "MERCADO_PAGO",
    external: true
  };
}

function signatureParts(header: string | null) {
  const parts = new Map<string, string>();
  for (const part of String(header || "").split(",")) {
    const [key, value] = part.split("=");
    if (key && value) parts.set(key.trim(), value.trim());
  }
  return {
    timestamp: parts.get("ts") || "",
    hash: parts.get("v1") || ""
  };
}

function dataIdFrom(url: URL, payload: MercadoPagoWebhookPayload) {
  return cleanText(url.searchParams.get("data.id")) || cleanText(payload.data?.id);
}

function webhookDedupeKey(input: {
  providerEventId: string;
  requestId: string;
  dataId: string;
  eventType: string;
  action: string;
  payload: unknown;
}) {
  const naturalKey = input.providerEventId || [input.requestId, input.dataId, input.eventType, input.action].filter(Boolean).join(":");
  if (naturalKey) return `mercado_pago:${naturalKey}`;
  return `mercado_pago:payload:${createHash("sha256").update(JSON.stringify(input.payload ?? {})).digest("hex")}`;
}

function verifyWebhookSignature(request: Request, url: URL, payload: MercadoPagoWebhookPayload) {
  const secret = cleanText(process.env.MERCADO_PAGO_WEBHOOK_SECRET);
  if (!secret) return { valid: false, reason: "WEBHOOK_SECRET_MISSING" };

  const requestId = cleanText(request.headers.get("x-request-id"));
  const { timestamp, hash } = signatureParts(request.headers.get("x-signature"));
  const dataId = dataIdFrom(url, payload).toLowerCase();

  if (!requestId || !timestamp || !hash || !dataId) {
    return { valid: false, reason: "SIGNATURE_HEADERS_MISSING" };
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(hash, "hex");
  if (expectedBuffer.length !== receivedBuffer.length) {
    return { valid: false, reason: "SIGNATURE_MISMATCH" };
  }

  const valid = timingSafeEqual(expectedBuffer, receivedBuffer);
  return {
    valid,
    reason: valid ? "OK" : "SIGNATURE_MISMATCH"
  };
}

function isMercadoPagoSimulatorNotification(input: {
  payload: MercadoPagoWebhookPayload;
  dataId: string;
  eventType: string;
  action: string;
}) {
  return (
    input.payload.live_mode === false &&
    cleanText(input.payload.id) === "123456" &&
    input.dataId === "123456" &&
    input.eventType === "payment" &&
    input.action === "payment.updated"
  );
}

async function fetchPaymentDetails(paymentId: string) {
  const config = mercadoPagoConfig();
  const response = await fetch(`${MERCADO_PAGO_API_BASE}/v1/payments/${encodeURIComponent(paymentId)}`, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${config.accessToken}`
    }
  });
  const payload = (await response.json().catch(() => ({}))) as MercadoPagoPaymentResponse & Record<string, unknown>;
  if (!response.ok) {
    throw new MercadoPagoError(cleanText(payload.message) || "Não foi possível consultar o pagamento Mercado Pago.");
  }
  return payload;
}

async function applyPaymentDetails(paymentDetails: MercadoPagoPaymentResponse & Record<string, unknown>) {
  const externalReference = cleanText(paymentDetails.external_reference);
  const providerPaymentId = cleanText(paymentDetails.id);
  const providerStatus = cleanText(paymentDetails.status) || "unknown";
  const providerStatusDetail = cleanText(paymentDetails.status_detail) || null;
  const payload = toJsonValue(paymentDetails);
  const parsedPaidAt = paymentDetails.date_approved ? new Date(paymentDetails.date_approved) : null;
  const paidAt = parsedPaidAt && !Number.isNaN(parsedPaidAt.getTime()) ? parsedPaidAt : new Date();

  if (!externalReference) {
    return { status: "MISSING_EXTERNAL_REFERENCE" };
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: externalReference },
    include: { payment: true }
  });
  if (!order || !order.payment) {
    return { status: "ORDER_NOT_FOUND", orderNumber: externalReference };
  }
  const orderId = order.id;

  const receivedAmountCents = amountToCents(paymentDetails.transaction_amount);
  const providerUpdate = {
    provider: "MERCADO_PAGO" as const,
    providerPaymentId: providerPaymentId || null,
    providerExternalReference: externalReference,
    providerStatus,
    providerStatusDetail,
    providerPayload: payload,
    lastWebhookAt: new Date()
  };

  async function recordProviderStatus(syncError: string | null, failed = false) {
    const updated = await prisma.payment.updateMany({
      where: { orderId, status: { not: "PAID" } },
      data: { ...providerUpdate, status: failed ? "FAILED" : undefined, syncError }
    });
    if (updated.count === 0 && providerPaymentId) {
      await prisma.payment.updateMany({
        where: { orderId, status: "PAID", provider: "MERCADO_PAGO", providerPaymentId },
        data: { lastWebhookAt: providerUpdate.lastWebhookAt, syncError }
      });
    }
  }

  if (receivedAmountCents !== order.totalCents) {
    const message = `Valor Mercado Pago não confere: recebido ${receivedAmountCents ?? "desconhecido"} cents, pedido ${order.totalCents} cents.`;
    await recordProviderStatus(message);
    return { status: "AMOUNT_MISMATCH", orderNumber: externalReference };
  }

  if (providerStatus === "approved") {
    if (!providerPaymentId) {
      await recordProviderStatus("Mercado Pago retornou um pagamento aprovado sem identificação.");
      return { status: "PAYMENT_ID_MISSING", orderNumber: externalReference };
    }
    try {
      await markOrderPaid(externalReference, {
        ...providerUpdate,
        source: "mercado_pago",
        providerPaymentId,
        providerStatus,
        paidAt
      });
      return { status: "PAID", orderNumber: externalReference };
    } catch (error) {
      if (!(error instanceof OrderError)) throw error;
      await recordProviderStatus(error.message);
      return { status: "SETTLEMENT_FAILED", orderNumber: externalReference };
    }
  }

  const failedStatuses = new Set(["rejected", "cancelled", "canceled"]);
  const manualReviewStatuses = new Set(["refunded", "charged_back"]);
  const failed = failedStatuses.has(providerStatus);
  await recordProviderStatus(
    failed || manualReviewStatuses.has(providerStatus) ? `Mercado Pago retornou ${providerStatus}.` : null,
    failed
  );

  return { status: providerStatus.toUpperCase(), orderNumber: externalReference };
}

export async function processMercadoPagoWebhook(request: Request, payload: MercadoPagoWebhookPayload) {
  const url = new URL(request.url);
  const providerEventId = cleanText(payload.id);
  const requestId = cleanText(request.headers.get("x-request-id"));
  const dataId = dataIdFrom(url, payload);
  const eventType = cleanText(payload.type || url.searchParams.get("type") || url.searchParams.get("topic"));
  const action = cleanText(payload.action || url.searchParams.get("action"));
  const dedupeKey = webhookDedupeKey({ providerEventId, requestId, dataId, eventType, action, payload });
  const signature = verifyWebhookSignature(request, url, payload);
  const payloadJson = toJsonValue(payload);

  if (signature.reason === "WEBHOOK_SECRET_MISSING") {
    return {
      httpStatus: 503,
      body: { ok: false, status: signature.reason }
    };
  }

  if (!signature.valid) {
    await prisma.paymentWebhookEvent.upsert({
      where: { dedupeKey },
      update: {
        signatureValid: false,
        payload: payloadJson
      },
      create: {
        dedupeKey,
        providerEventId,
        requestId,
        dataId,
        eventType,
        action,
        signatureValid: false,
        payload: payloadJson,
        processedAt: new Date()
      }
    });
    return {
      httpStatus: signature.reason === "WEBHOOK_SECRET_MISSING" ? 503 : 401,
      body: { ok: false, status: signature.reason }
    };
  }

  const existing = await prisma.paymentWebhookEvent.findUnique({ where: { dedupeKey } });
  if (existing?.processedAt && existing.signatureValid) {
    return {
      httpStatus: 200,
      body: { ok: true, status: "DUPLICATE", dataId }
    };
  }

  const event = await prisma.paymentWebhookEvent.upsert({
    where: { dedupeKey },
    update: { signatureValid: true, payload: payloadJson },
    create: {
      dedupeKey,
      providerEventId,
      requestId,
      dataId,
      eventType,
      action,
      signatureValid: true,
      payload: payloadJson
    }
  });

  if (!dataId) {
    await prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() }
    });
    return { httpStatus: 202, body: { ok: false, status: "PAYMENT_ID_MISSING" } };
  }

  if (isMercadoPagoSimulatorNotification({ payload, dataId, eventType, action })) {
    await prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() }
    });
    return { httpStatus: 200, body: { ok: true, status: "SIMULATOR_RECEIVED", dataId } };
  }

  const paymentDetails = await fetchPaymentDetails(dataId);
  const result = await applyPaymentDetails(paymentDetails);

  await prisma.paymentWebhookEvent.update({
    where: { id: event.id },
    data: { processedAt: new Date() }
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      status: result.status,
      dataId,
      orderNumber: "orderNumber" in result ? result.orderNumber : undefined
    }
  };
}
