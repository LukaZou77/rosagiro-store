import assert from "node:assert/strict";
import test from "node:test";
import { storefrontPaymentLabel, storefrontPaymentNote } from "@/lib/payments";
import { defaultStoreProfile, publicStoreProfileNotes, storeTrustSignals } from "@/lib/store-profile";

test("cached payment notes use the current credit-card installment policy", () => {
  for (const paymentNote of ["Pix e transferência bancária", "Pix e cartão via Mercado Pago", "Cartao em 12x", "Cartões de crédito", "Pagamento simulado"]) {
    assert.equal(publicStoreProfileNotes({ ...defaultStoreProfile, paymentNote }).paymentNote, storefrontPaymentNote);
  }
});

test("footer and trust badges show card installments while preserving unrelated signals", () => {
  const signals = storeTrustSignals({ ...defaultStoreProfile, trustBadges: ["Atendimento pelo WhatsApp", "Pix e cartão via Mercado Pago", "Envio para todo o Brasil"] });
  assert.ok(signals.includes(storefrontPaymentLabel));
  assert.ok(signals.includes("Atendimento pelo WhatsApp"));
  assert.ok(signals.includes("Envio para todo o Brasil"));
  assert.match(signals.join(" "), /cartão de crédito com parcelamento/i);
  assert.doesNotMatch(signals.join(" "), /sem juros|taxa zero|em 1x/i);
});

test("the current payment note remains unchanged", () => {
  assert.equal(publicStoreProfileNotes({ ...defaultStoreProfile, paymentNote: storefrontPaymentNote }).paymentNote, storefrontPaymentNote);
});
