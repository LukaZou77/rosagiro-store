import assert from "node:assert/strict";
import test from "node:test";
import {
  isPaymentMethod,
  paymentMethodLabel,
  paymentMethodsForCheckout,
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

test("disabling assisted checkout does not expose credit cards", () => {
  assert.deepEqual(paymentMethodsForCheckout({ includeSimulated: false }).map((method) => method.value), ["PIX"]);
});

test("new checkout payloads reject credit cards without relabeling historical card orders", () => {
  assert.equal(isPaymentMethod("CREDIT_CARD"), false);
  assert.equal(isPaymentMethod("PIX"), true);
  assert.equal(isPaymentMethod("SIMULATED"), true);
  assert.equal(isPaymentMethod("BANK_TRANSFER"), false);
  assert.equal(paymentMethodLabel("CREDIT_CARD"), "Cartão de crédito");
});
