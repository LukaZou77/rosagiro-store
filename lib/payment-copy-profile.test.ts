import assert from "node:assert/strict";
import test from "node:test";
import { storefrontPaymentLabel, storefrontPaymentNote } from "@/lib/payments";
import { defaultStoreProfile, publicStoreProfileNotes, storeTrustSignals } from "@/lib/store-profile";

test("cached legacy payment notes cannot keep advertising card payments", () => {
  for (const paymentNote of ["Pix e cartão via Mercado Pago", "Cartao em 12x", "Cartões de crédito", "Pagamento simulado"]) {
    assert.equal(publicStoreProfileNotes({ ...defaultStoreProfile, paymentNote }).paymentNote, storefrontPaymentNote);
  }
});

test("footer and trust badges replace legacy card copy while preserving unrelated signals", () => {
  const signals = storeTrustSignals({ ...defaultStoreProfile, trustBadges: ["Atendimento pelo WhatsApp", "Pix e cartão via Mercado Pago", "Envio para todo o Brasil"] });
  assert.ok(signals.includes(storefrontPaymentLabel));
  assert.ok(signals.includes("Atendimento pelo WhatsApp"));
  assert.ok(signals.includes("Envio para todo o Brasil"));
  assert.doesNotMatch(signals.join(" "), /cartão|crédito|parcelamento/i);
});

test("current bank-transfer instructions remain unchanged", () => {
  assert.equal(publicStoreProfileNotes({ ...defaultStoreProfile, paymentNote: storefrontPaymentNote }).paymentNote, storefrontPaymentNote);
});
