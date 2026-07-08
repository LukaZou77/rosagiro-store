import assert from "node:assert/strict";
import test from "node:test";
import {
  GOOGLE_ADS_WHATSAPP_CONVERSION_SEND_TO,
  isWhatsAppTrackingHref
} from "./google-ads";

test("identifies WhatsApp outbound links for conversion tracking", () => {
  assert.equal(isWhatsAppTrackingHref("https://wa.me/5511970792390?text=Oi"), true);
  assert.equal(isWhatsAppTrackingHref("https://api.whatsapp.com/send?phone=5511970792390"), true);
  assert.equal(isWhatsAppTrackingHref("https://web.whatsapp.com/send?phone=5511970792390"), true);
  assert.equal(isWhatsAppTrackingHref("https://rosagiro.com.br/produto/batom"), false);
  assert.equal(isWhatsAppTrackingHref("mailto:contato@rosagiro.com.br"), false);
});

test("uses the WhatsApp咨询 Google Ads conversion destination", () => {
  assert.equal(GOOGLE_ADS_WHATSAPP_CONVERSION_SEND_TO, "AW-17323505855/I2h6CKzc_cwcEL_xvsRA");
});
