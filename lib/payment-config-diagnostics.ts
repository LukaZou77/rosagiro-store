import { isMercadoPagoMode, normalizePaymentMode, type PaymentMode } from "@/lib/payments";

export type PaymentDiagnosticStatus = "READY" | "WARNING" | "ACTION_REQUIRED";
export type PaymentDiagnosticSeverity = "low" | "medium" | "high";

export type PaymentDiagnosticCheck = {
  key: string;
  label: string;
  status: PaymentDiagnosticStatus;
  severity: PaymentDiagnosticSeverity;
  message: string;
};

const webhookEndpointPath = "/api/webhooks/mercado-pago";

function clean(value: string | undefined) {
  return String(value || "").trim();
}

function publicHttpsUrl(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}

function check(input: PaymentDiagnosticCheck): PaymentDiagnosticCheck {
  return input;
}

function statusLabel(status: PaymentDiagnosticStatus, mode: PaymentMode) {
  if (status === "READY") return mode === "mercado_pago_live" ? "Live pronto" : "Sandbox pronto";
  if (status === "WARNING") return mode === "simulated" ? "Modo simulado" : "Revisar configuração";
  return "Ação necessária";
}

function buildFallbackMessage(mode: PaymentMode, checks: PaymentDiagnosticCheck[]) {
  const modeCheck = checks.find((item) => item.key === "payment-mode");
  if (modeCheck?.status === "ACTION_REQUIRED") {
    return modeCheck.message;
  }

  if (mode === "simulated") {
    return "Checkout está em modo simulado; Pix e cartão não abrem Mercado Pago neste ambiente.";
  }

  const blocking = checks.filter((item) => item.status === "ACTION_REQUIRED");
  if (!blocking.length) {
    return mode === "mercado_pago_live"
      ? "Pix e cartão podem abrir Checkout Pro live quando o cliente finalizar pedido."
      : "Pix e cartão podem abrir Checkout Pro sandbox quando o cliente finalizar pedido.";
  }
  return `Mercado Pago fica indisponível até resolver: ${blocking.map((item) => item.label).join(", ")}.`;
}

function buildConfigChecks(env: NodeJS.ProcessEnv): PaymentDiagnosticCheck[] {
  const rawPaymentMode = clean(env.PAYMENT_MODE);
  const paymentMode = normalizePaymentMode(rawPaymentMode);
  const mercadoPagoMode = isMercadoPagoMode(paymentMode);
  const hasAccessToken = Boolean(clean(env.MERCADO_PAGO_ACCESS_TOKEN));
  const hasWebhookSecret = Boolean(clean(env.MERCADO_PAGO_WEBHOOK_SECRET));
  const hasPublicSiteUrl = publicHttpsUrl(clean(env.NEXT_PUBLIC_SITE_URL));

  return [
    check({
      key: "payment-mode",
      label: "Modo de pagamento",
      status:
        paymentMode === "mercado_pago_sandbox" || paymentMode === "mercado_pago_live"
          ? "READY"
          : rawPaymentMode === "simulated" || !rawPaymentMode
            ? "WARNING"
            : "ACTION_REQUIRED",
      severity: paymentMode === "mercado_pago_live" ? "high" : paymentMode === "mercado_pago_sandbox" ? "medium" : "high",
      message:
        paymentMode === "mercado_pago_live"
          ? "PAYMENT_MODE está configurado para live."
          : paymentMode === "mercado_pago_sandbox"
          ? "PAYMENT_MODE está configurado para sandbox."
          : rawPaymentMode === "simulated" || !rawPaymentMode
            ? "PAYMENT_MODE está em modo simulado; Pix/cartão usam fluxo local."
            : "PAYMENT_MODE tem valor não reconhecido para esta integração."
    }),
    check({
      key: "access-token",
      label: "Access token Mercado Pago",
      status: hasAccessToken ? "READY" : mercadoPagoMode ? "ACTION_REQUIRED" : "WARNING",
      severity: "high",
      message: hasAccessToken
        ? "Token existe no ambiente atual; valor não é exibido."
        : mercadoPagoMode
          ? "MERCADO_PAGO_ACCESS_TOKEN ainda não foi configurado."
          : "Token não é necessário enquanto PAYMENT_MODE estiver simulado."
    }),
    check({
      key: "webhook-secret",
      label: "Webhook secret",
      status: hasWebhookSecret ? "READY" : mercadoPagoMode ? "ACTION_REQUIRED" : "WARNING",
      severity: "high",
      message: hasWebhookSecret
        ? "Secret existe para validar x-signature; valor não é exibido."
        : mercadoPagoMode
          ? "MERCADO_PAGO_WEBHOOK_SECRET é obrigatório para processar webhooks."
          : "Webhook secret não é necessário enquanto PAYMENT_MODE estiver simulado."
    }),
    check({
      key: "public-url",
      label: "URL pública HTTPS",
      status: hasPublicSiteUrl ? "READY" : mercadoPagoMode ? "ACTION_REQUIRED" : "WARNING",
      severity: "high",
      message: hasPublicSiteUrl
        ? `NEXT_PUBLIC_SITE_URL parece público; Mercado Pago pode chamar ${webhookEndpointPath}.`
        : mercadoPagoMode
          ? "NEXT_PUBLIC_SITE_URL ainda parece local, vazio ou sem HTTPS público."
          : "URL pública é opcional enquanto PAYMENT_MODE estiver simulado."
    })
  ];
}

export function buildPaymentConfigDiagnostics(env: NodeJS.ProcessEnv = process.env) {
  const configChecks = buildConfigChecks(env);
  const mode = normalizePaymentMode(env.PAYMENT_MODE);
  const hasActionRequired = configChecks.some((item) => item.status === "ACTION_REQUIRED");
  const status: PaymentDiagnosticStatus = configChecks.every((item) => item.status === "READY")
    ? "READY"
    : hasActionRequired
      ? "ACTION_REQUIRED"
      : "WARNING";

  return {
    status,
    statusLabel: statusLabel(status, mode),
    fallbackMessage: buildFallbackMessage(mode, configChecks),
    modeLabel: clean(env.PAYMENT_MODE) || "simulated",
    webhookEndpointPath,
    configChecks
  };
}
