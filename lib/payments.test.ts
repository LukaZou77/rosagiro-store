import assert from "node:assert/strict";
import test from "node:test";
import { buildPaymentConfigDiagnostics } from "@/lib/payment-config-diagnostics";
import {
  isPaymentMethod,
  canConfirmSimulatedPayment,
  paymentMethodLabel,
  paymentMethodsForCheckout,
  paymentModeForEnvironment,
  normalizeMercadoPagoInstallments,
  simulatedPaymentEnabled,
  simulatedPaymentPendingStatus,
  storefrontPaymentLabel,
  storefrontPaymentNote
} from "@/lib/payments";

test("checkout offers Pix, credit card installments and assisted bank transfer", () => {
  const methods = paymentMethodsForCheckout();
  assert.deepEqual(methods.map((method) => method.value), ["PIX", "CREDIT_CARD", "SIMULATED"]);
  assert.match(methods[1].label, /Cartão de crédito/);
  assert.match(methods[2].description, /transferência bancária/);
  assert.match(methods[1].description, /parcelas disponíveis, os valores e as taxas/);
  assert.doesNotMatch(JSON.stringify(methods), /sem juros|taxa zero|em 1x/i);
  assert.match(storefrontPaymentLabel, /cartão de crédito com parcelamento/);
  assert.match(storefrontPaymentNote, /disponibilidade dos produtos/);
});

test("the test option is labeled separately from assisted transfer", () => {
  assert.deepEqual(paymentMethodsForCheckout({ testPayments: true }).map((method) => method.label), ["Pix", "Cartão de crédito", "Pagamento de teste"]);
});

test("new checkout payloads accept credit cards and preserve the historical label", () => {
  assert.equal(isPaymentMethod("CREDIT_CARD"), true);
  assert.equal(isPaymentMethod("PIX"), true);
  assert.equal(isPaymentMethod("SIMULATED"), true);
  assert.equal(isPaymentMethod("BANK_TRANSFER"), false);
  assert.equal(paymentMethodLabel("CREDIT_CARD"), "Cartão de crédito");
});

test("an unavailable gateway hides cards while keeping Pix and assisted transfer", () => {
  assert.deepEqual(paymentMethodsForCheckout({ allowCreditCard: false }).map((method) => method.value), ["PIX", "SIMULATED"]);
});

test("supported installment settings include the existing twelve-payment configuration", () => {
  assert.equal(normalizeMercadoPagoInstallments(12), 12);
  assert.equal(normalizeMercadoPagoInstallments("9"), 9);
  assert.equal(normalizeMercadoPagoInstallments("invalid"), 6);
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
