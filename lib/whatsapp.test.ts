import assert from "node:assert/strict";
import test from "node:test";
import { buildCartWhatsAppHref } from "./whatsapp";

test("describes wholesale cart lines as complete packages instead of retail units", () => {
  const href = buildCartWhatsAppHref(
    [
      {
        quantity: 36,
        packagePieces: 36,
        product: {
          name: "Iluminador Ruby Rose HB-M701",
          priceCents: 913,
          brand: { name: "Ruby Rose" }
        }
      }
    ],
    32868,
    "5511970792390"
  );
  const message = new URL(href).searchParams.get("text") || "";

  assert.match(message, /1 embalagem fechada \(36 unidades\)/i);
  assert.doesNotMatch(message, /- 36x/i);
  assert.match(message, /R\$\s*500,00/i);
});
