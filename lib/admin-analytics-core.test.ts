import assert from "node:assert/strict";
import test from "node:test";
import {
  adminAnalyticsWindow,
  analyticsChange,
  analyticsVisitorRetentionCutoff,
  parseAdminAnalyticsComparison,
  parseAdminAnalyticsPeriod,
  saoPauloDateTime,
  shiftDateKey
} from "@/lib/admin-analytics-core";

test("calcula meia-noite e deslocamentos no horario de Sao Paulo", () => {
  assert.equal(saoPauloDateTime("2026-07-11").toISOString(), "2026-07-11T03:00:00.000Z");
  assert.equal(shiftDateKey("2026-03-01", -1), "2026-02-28");
});

test("hoje compara com o mesmo trecho de ontem", () => {
  const range = adminAnalyticsWindow("today", "previous_period", new Date("2026-07-11T18:30:00.000Z"));
  assert.equal(range.currentStart.toISOString(), "2026-07-11T03:00:00.000Z");
  assert.equal(range.currentEnd.toISOString(), "2026-07-11T18:30:00.000Z");
  assert.equal(range.comparisonStart.toISOString(), "2026-07-10T03:00:00.000Z");
  assert.equal(range.comparisonEnd.toISOString(), "2026-07-10T18:30:00.000Z");
  assert.equal(range.bucket, "hour");
});

test("semana comeca na segunda e usa trecho equivalente", () => {
  const range = adminAnalyticsWindow("week", "previous_period", new Date("2026-07-11T15:00:00.000Z"));
  assert.equal(range.currentStartKey, "2026-07-06");
  assert.equal(range.comparisonStartKey, "2026-06-29");
  assert.equal(range.bucket, "day");
});

test("mes e ano anterior respeitam periodo parcial e ano bissexto", () => {
  const month = adminAnalyticsWindow("month", "previous_period", new Date("2026-03-31T15:00:00.000Z"));
  assert.equal(month.currentStartKey, "2026-03-01");
  assert.equal(month.comparisonStartKey, "2026-02-01");
  assert.equal(month.comparisonEnd.toISOString(), "2026-03-01T03:00:00.000Z");

  const year = adminAnalyticsWindow("year", "previous_year", new Date("2024-02-29T15:00:00.000Z"));
  assert.equal(year.currentStartKey, "2024-01-01");
  assert.equal(year.comparisonStartKey, "2023-01-01");
  assert.equal(year.bucket, "month");
});

test("nao inventa 100 por cento quando a base e zero ou inexistente", () => {
  assert.deepEqual(analyticsChange(8, 0, true), { current: 8, previous: 0, delta: 8, percent: null, state: "new" });
  assert.deepEqual(analyticsChange(0, 0, true), { current: 0, previous: 0, delta: 0, percent: 0, state: "flat" });
  assert.deepEqual(analyticsChange(8, 0, false), { current: 8, previous: 0, delta: 8, percent: null, state: "no_data" });
  assert.equal(analyticsChange(75, 100, true).percent, -25);
});

test("normaliza filtros e calcula retencao pseudonimizada", () => {
  assert.equal(parseAdminAnalyticsPeriod("year"), "year");
  assert.equal(parseAdminAnalyticsPeriod("90d"), "today");
  assert.equal(parseAdminAnalyticsComparison("previous_year"), "previous_year");
  assert.equal(parseAdminAnalyticsComparison("invalid"), "previous_period");
  assert.equal(analyticsVisitorRetentionCutoff(new Date("2026-07-11T15:00:00.000Z")).toISOString(), "2024-06-11T00:00:00.000Z");
});
