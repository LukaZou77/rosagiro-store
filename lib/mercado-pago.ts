import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { OrderError, markOrderPaid } from "@/lib/orders";
import type { PaymentMethodValue } from "@/lib/payments";
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

export function mercadoPagoSandboxReady() {
  return (
    process.env.PAYMENT_MODE === "mercado_pago_sandbox" &&
    Boolean(cleanText(process.env.MERCADO_PAGO_ACCESS_TOKEN)) &&
    Boolean(siteUrl())
  );
}

function sandboxConfig() {
  const accessToken = cleanText(process.env.MERCADO_PAGO_ACCESS_TOKEN);
  const publicUrl = siteUrl();
  if (!accessToken || !publicUrl) {
    throw new MercadoPagoError("Mercado Pago sandbox não está configurado.");
  }
  return { accessToken, publicUrl };
}

function simulatedPaymentResult(orderNumber: string): PaymentStartResult {
  return {
    orderNumber,
    redirectTo: `/pagamento-simulado/${orderNumber}`,
    provider: "SIMULATED",
    external: false
  };
}

export async function startOrderPayment(orderNumber: string): Promise<PaymentStartResult> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { payment: true }
  });
  if (!order || !order.payment) throw new MercadoPagoError("Pedido não encontrado.", 404);
  if (!shouldUseMercadoPago(order.payment.method) || !mercadoPagoSandboxReady()) {
    return simulatedPaymentResult(order.orderNumber);
  }

  const existingRedirect = order.payment.providerSandboxInitPoint || order.payment.providerInitPoint;
  if (order.payment.providerPreferenceId && existingRedirect) {
    return {
      orderNumber: order.orderNumber,
      redirectTo: existingRedirect,
      provider: "MERCADO_PAGO",
      external: true
    };
  }

  const config = sandboxConfig();
  const payerName = splitName(order.customerName);
  const payerPhone = splitPhone(order.customerPhone);
  const baseOrderUrl = `${config.publicUrl}/pedido/${encodeURIComponent(order.orderNumber)}`;
  const maxInstallments = configuredMercadoPagoInstallments(await getStoreProfile());
  const preferenceBody = {
    items: [
      {
        id: order.orderNumber,
        title: `Pedido RosaGiro ${order.orderNumber}`,
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
      identification: {
        type: "CPF",
        number: digits(order.customerCpf)
      },
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
      max_installments: maxInstallments
    }
  };

  const response = await fetch(`${MERCADO_PAGO_API_BASE}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(preferenceBody)
  });
  const payload = (await response.json().catch(() => ({}))) as MercadoPagoPreferenceResponse & Record<string, unknown>;

  if (!response.ok) {
    const message = cleanText(payload.message) || "Não foi possível criar a preferência Mercado Pago.";
    await prisma.payment.update({
      where: { orderId: order.id },
      data: {
        provider: "MERCADO_PAGO",
        providerExternalReference: order.orderNumber,
        providerPayload: toJsonValue(payload),
        syncError: message
      }
    });
    throw new MercadoPagoError(message);
  }

  const redirectTo = cleanText(payload.sandbox_init_point) || cleanText(payload.init_point);
  const preferenceId = cleanText(payload.id);
  if (!preferenceId || !redirectTo) {
    const message = "Mercado Pago não retornou uma URL de checkout.";
    await prisma.payment.update({
      where: { orderId: order.id },
      data: {
        provider: "MERCADO_PAGO",
        providerExternalReference: order.orderNumber,
        providerPayload: toJsonValue(payload),
        syncError: message
      }
    });
    throw new MercadoPagoError(message);
  }

  await prisma.payment.update({
    where: { orderId: order.id },
    data: {
      provider: "MERCADO_PAGO",
      providerPreferenceId: preferenceId,
      providerExternalReference: order.orderNumber,
      providerInitPoint: cleanText(payload.init_point) || null,
      providerSandboxInitPoint: cleanText(payload.sandbox_init_point) || null,
      providerStatus: "preference_created",
      providerStatusDetail: null,
      providerPayload: toJsonValue(payload),
      syncError: null
    }
  });

  return {
    orderNumber: order.orderNumber,
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

async function fetchPaymentDetails(paymentId: string) {
  const config = sandboxConfig();
  const response = await fetch(`${MERCADO_PAGO_API_BASE}/v1/payments/${encodeURIComponent(paymentId)}`, {
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

  if (receivedAmountCents !== order.totalCents) {
    const message = `Valor Mercado Pago não confere: recebido ${receivedAmountCents ?? "desconhecido"} cents, pedido ${order.totalCents} cents.`;
    await prisma.payment.update({
      where: { orderId: order.id },
      data: {
        ...providerUpdate,
        syncError: message
      }
    });
    return { status: "AMOUNT_MISMATCH", orderNumber: externalReference };
  }

  if (providerStatus === "approved") {
    try {
      await markOrderPaid(externalReference, {
        ...providerUpdate,
        paidAt
      });
      return { status: "PAID", orderNumber: externalReference };
    } catch (error) {
      const message = error instanceof OrderError || error instanceof Error ? error.message : "Falha ao liquidar pedido.";
      await prisma.payment.update({
        where: { orderId: order.id },
        data: {
          ...providerUpdate,
          syncError: message
        }
      });
      return { status: "SETTLEMENT_FAILED", orderNumber: externalReference };
    }
  }

  const failedStatuses = new Set(["rejected", "cancelled", "canceled"]);
  const manualReviewStatuses = new Set(["refunded", "charged_back"]);
  await prisma.payment.update({
    where: { orderId: order.id },
    data: {
      ...providerUpdate,
      status: failedStatuses.has(providerStatus) && order.status !== "PAID" ? "FAILED" : order.payment.status,
      syncError: failedStatuses.has(providerStatus) || manualReviewStatuses.has(providerStatus) ? `Mercado Pago retornou ${providerStatus}.` : null
    }
  });

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

  const event = existing
    ? await prisma.paymentWebhookEvent.update({
        where: { dedupeKey },
        data: { signatureValid: true, payload: payloadJson }
      })
    : await prisma.paymentWebhookEvent.create({
        data: {
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
