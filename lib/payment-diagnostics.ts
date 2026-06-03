import "server-only";

import { prisma } from "@/lib/db";
import {
  buildPaymentConfigDiagnostics,
  type PaymentDiagnosticCheck,
  type PaymentDiagnosticSeverity,
  type PaymentDiagnosticStatus
} from "@/lib/payment-config-diagnostics";
import { paymentMethodLabel, paymentProviderLabel, paymentStatusLabel } from "@/lib/payments";

export { buildPaymentConfigDiagnostics };
export type { PaymentDiagnosticCheck, PaymentDiagnosticSeverity, PaymentDiagnosticStatus };

export type RecentPaymentDiagnostic = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  amountCents: number;
  provider: string;
  providerLabel: string;
  method: string;
  methodLabel: string;
  status: string;
  statusLabel: string;
  providerPreferenceId: string | null;
  providerPaymentId: string | null;
  providerExternalReference: string | null;
  providerStatus: string | null;
  providerStatusDetail: string | null;
  syncError: string | null;
  lastWebhookAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RecentWebhookDiagnostic = {
  id: string;
  providerEventId: string | null;
  requestId: string | null;
  dataId: string | null;
  eventType: string | null;
  action: string | null;
  signatureValid: boolean;
  processedAt: Date | null;
  createdAt: Date;
};

export type PaymentDiagnosticSnapshot = {
  status: PaymentDiagnosticStatus;
  statusLabel: string;
  fallbackMessage: string;
  modeLabel: string;
  webhookEndpointPath: string;
  configChecks: PaymentDiagnosticCheck[];
  recentPayments: RecentPaymentDiagnostic[];
  recentWebhookEvents: RecentWebhookDiagnostic[];
  counts: {
    mercadoPagoPayments: number;
    simulatedPayments: number;
    pendingPayments: number;
    webhookEvents: number;
    invalidWebhookSignatures: number;
  };
};

export async function getPaymentDiagnosticSnapshot(): Promise<PaymentDiagnosticSnapshot> {
  const config = buildPaymentConfigDiagnostics();
  const [recentPayments, recentWebhookEvents, counts] = await Promise.all([
    prisma.payment.findMany({
      include: { order: true },
      orderBy: { updatedAt: "desc" },
      take: 12
    }),
    prisma.paymentWebhookEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    Promise.all([
      prisma.payment.count({ where: { provider: "MERCADO_PAGO" } }),
      prisma.payment.count({ where: { provider: "SIMULATED" } }),
      prisma.payment.count({ where: { status: "PENDING" } }),
      prisma.paymentWebhookEvent.count(),
      prisma.paymentWebhookEvent.count({ where: { signatureValid: false } })
    ])
  ]);

  return {
    ...config,
    recentPayments: recentPayments.map((payment) => ({
      id: payment.id,
      orderNumber: payment.order.orderNumber,
      orderStatus: payment.order.status,
      amountCents: payment.amountCents,
      provider: payment.provider,
      providerLabel: paymentProviderLabel(payment.provider),
      method: payment.method,
      methodLabel: paymentMethodLabel(payment.method),
      status: payment.status,
      statusLabel: paymentStatusLabel(payment.status),
      providerPreferenceId: payment.providerPreferenceId,
      providerPaymentId: payment.providerPaymentId,
      providerExternalReference: payment.providerExternalReference,
      providerStatus: payment.providerStatus,
      providerStatusDetail: payment.providerStatusDetail,
      syncError: payment.syncError,
      lastWebhookAt: payment.lastWebhookAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    })),
    recentWebhookEvents: recentWebhookEvents.map((event) => ({
      id: event.id,
      providerEventId: event.providerEventId,
      requestId: event.requestId,
      dataId: event.dataId,
      eventType: event.eventType,
      action: event.action,
      signatureValid: event.signatureValid,
      processedAt: event.processedAt,
      createdAt: event.createdAt
    })),
    counts: {
      mercadoPagoPayments: counts[0],
      simulatedPayments: counts[1],
      pendingPayments: counts[2],
      webhookEvents: counts[3],
      invalidWebhookSignatures: counts[4]
    }
  };
}
