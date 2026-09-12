import assert from "node:assert/strict";
import test from "node:test";
import { buildCartWhatsAppHref, buildGeneralWhatsAppHref, buildProductWhatsAppHref } from "./whatsapp";

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

test("source inquiry distinguishes price per package from whole-box quote without claiming stock", () => {
  const href = buildProductWhatsAppHref({
    slug: "lencos-pacote", name: "Lenços", brand: { name: "Marca" },
    priceCents: 400, stockStatus: "Sob consulta", inventory: { quantity: 999 },
    wholesalePackage: "Unidade de venda: pacote. Caixa: 24 pacotes; preço da caixa: R$ 96,00.",
    volume: "24 lenços por pacote"
  }, "5511970792390");
  const message = new URL(href).searchParams.get("text") || "";
  assert.match(message, /Preço por pacote: R\$\s*4,00/);
  assert.match(message, /preço da caixa: R\$\s*96,00/);
  assert.match(message, /Disponibilidade: sob consulta/);
  assert.doesNotMatch(message, /Disponibilidade: em estoque|Volume:/);
  assert.equal(new URL(href).pathname, "/5511970792390");
});
