import assert from "node:assert/strict";
import test from "node:test";
import { whatsAppLeadDedupeKey } from "@/lib/whatsapp-leads";

test("deduplica o mesmo WhatsApp registrado no mesmo minuto", () => {
  const first = whatsAppLeadDedupeKey("5511970792390", new Date("2026-07-11T15:42:01.000Z"));
  const repeated = whatsAppLeadDedupeKey("5511970792390", new Date("2026-07-11T15:42:59.999Z"));
  assert.equal(first, repeated);
});

test("mantem contatos e minutos distintos separados", () => {
  const base = whatsAppLeadDedupeKey("5511970792390", new Date("2026-07-11T15:42:00.000Z"));
  assert.notEqual(base, whatsAppLeadDedupeKey("5511966660000", new Date("2026-07-11T15:42:00.000Z")));
  assert.notEqual(base, whatsAppLeadDedupeKey("5511970792390", new Date("2026-07-11T15:43:00.000Z")));
});
