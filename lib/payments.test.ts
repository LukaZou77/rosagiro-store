import assert from "node:assert/strict";
import test from "node:test";
import { buildPaymentConfigDiagnostics } from "@/lib/payment-config-diagnostics";
import {
  isPaymentMethod,
  canConfirmSimulatedPayment,
  paymentMethodLabel,
  paymentMethodsForCheckout,
  paymentModeForEnvironment,
  simulatedPaymentEnabled,
  simulatedPaymentPendingStatus,
  storefrontPaymentLabel,
  storefrontPaymentNote
} from "@/lib/payments";

test("checkout offers Pix and assisted bank transfer without card or installment promises", () => {
  const methods = paymentMethodsForCheckout();
  assert.deepEqual(methods.map((method) => method.value), ["PIX", "SIMULATED"]);
  assert.match(methods[1].description, /transferência bancária/);
  assert.doesNotMatch(JSON.stringify(methods), /cartão|crédito|parcel|Mercado Pago/);
  assert.match(storefrontPaymentLabel, /Pix e transferência bancária/);
  assert.match(storefrontPaymentNote, /confirmação do estoque/);
});

test("the test option is labeled separately from assisted transfer", () => {
  assert.deepEqual(paymentMethodsForCheckout({ testPayments: true }).map((method) => method.label), ["Pix", "Pagamento de teste"]);
});

test("new checkout payloads reject credit cards without relabeling historical card orders", () => {
  assert.equal(isPaymentMethod("CREDIT_CARD"), false);
  assert.equal(isPaymentMethod("PIX"), true);
  assert.equal(isPaymentMethod("SIMULATED"), true);
  assert.equal(isPaymentMethod("BANK_TRANSFER"), false);
  assert.equal(paymentMethodLabel("CREDIT_CARD"), "Cartão de crédito");
});

test("missing, invalid and legacy simulated modes keep assisted payment as the safe default", () => {
  for (const PAYMENT_MODE of [undefined, "typo", "simulated", "manual"]) {
    assert.equal(paymentModeForEnvironment({ PAYMENT_MODE, NODE_ENV: "production" }), "manual");
  }
  assert.equal(paymentModeForEnvironment({ NODE_ENV: "production", PAYMENT_MODE: "mercado_pago_sandbox" }), "manual");
  assert.equal(paymentModeForEnvironment({ NODE_ENV: "production", PAYMENT_MODE: "mercado_pago_live" }), "mercado_pago_live");
});

test("simulation requires an explicit test environment, mode and opt-in", () => {
  const flags = { ENABLE_SIMULATED_PAYMENTS: "true", PAYMENT_MODE: "simulated" };
  assert.equal(simulatedPaymentEnabled(flags), false);
  assert.equal(simulatedPaymentEnabled({ ...flags, NODE_ENV: "development" }), true);
  assert.equal(simulatedPaymentEnabled({ ...flags, NODE_ENV: "test", PAYMENT_MODE: "mercado_pago_sandbox" }), true);
  assert.equal(simulatedPaymentEnabled({ ...flags, NODE_ENV: "test", PAYMENT_MODE: "mercado_pago_live" }), false);
  assert.equal(simulatedPaymentEnabled({ ...flags, NODE_ENV: "test", PAYMENT_MODE: "invalid" }), false);
  assert.equal(simulatedPaymentEnabled({ ...flags, NODE_ENV: "test", PAYMENT_MODE: undefined }), false);
  assert.equal(simulatedPaymentEnabled({ ...flags, NODE_ENV: "test", ENABLE_SIMULATED_PAYMENTS: "false" }), false);
  assert.equal(simulatedPaymentEnabled({ ...flags, NODE_ENV: "production", VERCEL_ENV: "preview" }), true);
  assert.equal(simulatedPaymentEnabled({ ...flags, NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "production" }), false);
  assert.equal(simulatedPaymentEnabled({ ...flags, NODE_ENV: "production" }), false);
  assert.equal(simulatedPaymentEnabled({ ...flags, NODE_ENV: "development", VERCEL_ENV: "production" }), false);
});

test("a manual payment or a platform payment cannot be simulated", () => {
  const testPayment = { provider: "SIMULATED", method: "SIMULATED", providerStatus: simulatedPaymentPendingStatus };
  assert.equal(canConfirmSimulatedPayment(testPayment), true);
  assert.equal(canConfirmSimulatedPayment({ ...testPayment, providerStatus: null }), false);
  assert.equal(canConfirmSimulatedPayment({ ...testPayment, method: "PIX" }), false);
  assert.equal(canConfirmSimulatedPayment({ ...testPayment, provider: "MERCADO_PAGO" }), false);
});

test("diagnostics report the effective production mode and warn about invalid configuration", () => {
  const production = {
    NODE_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "https://example.test",
    MERCADO_PAGO_ACCESS_TOKEN: "test-token",
    MERCADO_PAGO_WEBHOOK_SECRET: "test-secret"
  } as const;
  assert.equal(buildPaymentConfigDiagnostics({ ...production, PAYMENT_MODE: "mercado_pago_live" }).status, "READY");
  const manual = buildPaymentConfigDiagnostics({ ...production, PAYMENT_MODE: "mercado_pago_sandbox" });
  assert.equal(manual.modeLabel, "manual");
  assert.equal(manual.statusLabel, "Atendimento manual");
  assert.match(manual.configChecks[0].message, /desabilitado em produção/);
  const invalid = buildPaymentConfigDiagnostics({ ...production, PAYMENT_MODE: "invalid" });
  assert.equal(invalid.modeLabel, "manual");
  assert.equal(invalid.status, "ACTION_REQUIRED");
});
