import assert from "node:assert/strict";
import test from "node:test";
import {
  analyticsDateKeys,
  analyticsDeviceType,
  analyticsRetentionCutoff,
  brazilDateKey,
  hmacAnalyticsValue,
  isAnalyticsBot,
  normalizeAnalyticsIdentifier,
  normalizeAnalyticsPath,
  normalizeReferrerHost
} from "@/lib/site-analytics-core";

test("normaliza identificadores e rejeita entradas manipuladas", () => {
  assert.equal(normalizeAnalyticsIdentifier("abcDEF_1234567890"), "abcDEF_1234567890");
  assert.equal(normalizeAnalyticsIdentifier("curto"), null);
  assert.equal(normalizeAnalyticsIdentifier("id-com-espaco 123"), null);
});

test("mantem somente o caminho interno sem query", () => {
  assert.equal(normalizeAnalyticsPath("/produto/batom?gclid=segredo#foto"), "/produto/batom");
  assert.equal(normalizeAnalyticsPath("/admin/pedidos"), null);
  assert.equal(normalizeAnalyticsPath("https://example.com/produto"), null);
});

test("armazena apenas host de referencia externo", () => {
  assert.equal(normalizeReferrerHost("https://www.google.com/search?q=batom", "rosagiro.com.br"), "google.com");
  assert.equal(normalizeReferrerHost("https://www.rosagiro.com.br/produto", "rosagiro.com.br"), null);
});

test("HMAC e deterministico, irreversivel e depende do segredo", () => {
  const first = hmacAnalyticsValue("segredo-a", "192.0.2.10");
  assert.equal(first, hmacAnalyticsValue("segredo-a", "192.0.2.10"));
  assert.notEqual(first, hmacAnalyticsValue("segredo-b", "192.0.2.10"));
  assert.equal(first.includes("192.0.2.10"), false);
});

test("usa o dia civil de Sao Paulo nas bordas UTC", () => {
  assert.equal(brazilDateKey(new Date("2026-07-11T02:30:00.000Z")), "2026-07-10");
  assert.equal(brazilDateKey(new Date("2026-07-11T03:30:00.000Z")), "2026-07-11");
  assert.deepEqual(analyticsDateKeys(7, new Date("2026-07-11T15:00:00.000Z")), [
    "2026-07-05",
    "2026-07-06",
    "2026-07-07",
    "2026-07-08",
    "2026-07-09",
    "2026-07-10",
    "2026-07-11"
  ]);
});

test("calcula exatamente a janela de retencao de 90 dias", () => {
  assert.equal(analyticsRetentionCutoff(new Date("2026-07-11T12:00:00.000Z")).toISOString(), "2026-04-12T12:00:00.000Z");
});

test("classifica dispositivo e exclui robos conhecidos", () => {
  assert.equal(analyticsDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile"), "MOBILE");
  assert.equal(analyticsDeviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "DESKTOP");
  assert.equal(isAnalyticsBot("Mozilla/5.0 Googlebot/2.1"), true);
  assert.equal(isAnalyticsBot("Mozilla/5.0 Chrome/140.0"), false);
});
