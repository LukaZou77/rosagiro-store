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

function statusLabel(status: PaymentDiagnosticStatus) {
  if (status === "READY") return "Sandbox pronto";
  if (status === "WARNING") return "Usando fallback";
  return "Acao necessaria";
}

function buildFallbackMessage(checks: PaymentDiagnosticCheck[]) {
  const blocking = checks.filter((item) => item.status === "ACTION_REQUIRED");
  if (!blocking.length) {
    return "Pix e cartao podem abrir Checkout Pro sandbox quando o cliente finalizar pedido.";
  }
  return `Pix e cartao continuam caindo no pagamento simulado ate resolver: ${blocking
    .map((item) => item.label)
    .join(", ")}.`;
}

function buildConfigChecks(env: NodeJS.ProcessEnv): PaymentDiagnosticCheck[] {
  const paymentMode = clean(env.PAYMENT_MODE);
  const hasAccessToken = Boolean(clean(env.MERCADO_PAGO_ACCESS_TOKEN));
  const hasWebhookSecret = Boolean(clean(env.MERCADO_PAGO_WEBHOOK_SECRET));
  const hasPublicSiteUrl = publicHttpsUrl(clean(env.NEXT_PUBLIC_SITE_URL));

  return [
    check({
      key: "payment-mode",
      label: "Modo de pagamento",
      status:
        paymentMode === "mercado_pago_sandbox"
          ? "READY"
          : paymentMode === "simulated" || !paymentMode
            ? "WARNING"
            : "ACTION_REQUIRED",
      severity: paymentMode === "mercado_pago_sandbox" ? "medium" : "high",
      message:
        paymentMode === "mercado_pago_sandbox"
          ? "PAYMENT_MODE esta configurado para sandbox."
          : paymentMode === "simulated" || !paymentMode
            ? "PAYMENT_MODE esta em modo simulado; Pix/cartao usam fallback local."
            : "PAYMENT_MODE tem valor nao reconhecido para esta integracao."
    }),
    check({
      key: "access-token",
      label: "Access token sandbox",
      status: hasAccessToken ? "READY" : "ACTION_REQUIRED",
      severity: "high",
      message: hasAccessToken
        ? "Token existe no ambiente atual; valor nao e exibido."
        : "MERCADO_PAGO_ACCESS_TOKEN ainda nao foi configurado."
    }),
    check({
      key: "webhook-secret",
      label: "Webhook secret",
      status: hasWebhookSecret ? "READY" : "ACTION_REQUIRED",
      severity: "high",
      message: hasWebhookSecret
        ? "Secret existe para validar x-signature; valor nao e exibido."
        : "MERCADO_PAGO_WEBHOOK_SECRET e obrigatorio para processar webhooks."
    }),
    check({
      key: "public-url",
      label: "URL publica HTTPS",
      status: hasPublicSiteUrl ? "READY" : "ACTION_REQUIRED",
      severity: "high",
      message: hasPublicSiteUrl
        ? `NEXT_PUBLIC_SITE_URL parece publico; Mercado Pago pode chamar ${webhookEndpointPath}.`
        : "NEXT_PUBLIC_SITE_URL ainda parece local, vazio ou sem HTTPS publico."
    })
  ];
}

export function buildPaymentConfigDiagnostics(env: NodeJS.ProcessEnv = process.env) {
  const configChecks = buildConfigChecks(env);
  const hasActionRequired = configChecks.some((item) => item.status === "ACTION_REQUIRED");
  const status: PaymentDiagnosticStatus = configChecks.every((item) => item.status === "READY")
    ? "READY"
    : hasActionRequired
      ? "ACTION_REQUIRED"
      : "WARNING";

  return {
    status,
    statusLabel: statusLabel(status),
    fallbackMessage: buildFallbackMessage(configChecks),
    modeLabel: clean(env.PAYMENT_MODE) || "simulated",
    webhookEndpointPath,
    configChecks
  };
}
