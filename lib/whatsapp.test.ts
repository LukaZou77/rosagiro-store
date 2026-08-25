import assert from "node:assert/strict";
import test from "node:test";
import { buildCartWhatsAppHref, buildGeneralWhatsAppHref } from "./whatsapp";

test("uses the canonical wholesale minimum in general WhatsApp messages", () => {
  const href = buildGeneralWhatsAppHref("home atacado", "5511970792390");
  const message = new URL(href).searchParams.get("text") || "";

  assert.match(message, /Pedido mínimo para atacado: R\$\s*500,00\./i);
  assert.doesNotMatch(message, /R\$\s*300(?:,00)?/i);
});

test("describes wholesale cart lines as complete packages instead of retail units", () => {
  const href = buildCartWhatsAppHref(
    [
      {
        quantity: 36,
        packagePieces: 36,
        lineTotalCents: 32850,
        product: {
          name: "Iluminador Ruby Rose HB-M701",
          priceCents: 913,
          brand: { name: "Ruby Rose" }
        }
      }
    ],
    32850,
    "5511970792390"
  );
  const message = new URL(href).searchParams.get("text") || "";

  assert.match(message, /1 embalagem fechada \(36 unidades\)/i);
  assert.doesNotMatch(message, /- 36x/i);
  assert.match(message, /R\$\s*500,00/i);
  assert.match(message, /R\$\s*328,50/i);
  assert.doesNotMatch(message, /R\$\s*328,68/i);
});
