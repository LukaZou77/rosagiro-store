export const ADMIN_ANALYTICS_TIME_ZONE = "America/Sao_Paulo";

export const ADMIN_ANALYTICS_PERIODS = ["today", "week", "month", "year"] as const;
export type AdminAnalyticsPeriod = (typeof ADMIN_ANALYTICS_PERIODS)[number];

export const ADMIN_ANALYTICS_COMPARISONS = ["previous_period", "previous_year"] as const;
export type AdminAnalyticsComparison = (typeof ADMIN_ANALYTICS_COMPARISONS)[number];

export type AdminAnalyticsBucket = "hour" | "day" | "month";

export type AdminAnalyticsWindow = {
  period: AdminAnalyticsPeriod;
  comparison: AdminAnalyticsComparison;
  bucket: AdminAnalyticsBucket;
  currentStart: Date;
  currentEnd: Date;
  currentStartKey: string;
  currentEndKey: string;
  comparisonStart: Date;
  comparisonEnd: Date;
  comparisonStartKey: string;
  comparisonEndKey: string;
};

export type AnalyticsChange = {
  current: number;
  previous: number;
  delta: number;
  percent: number | null;
  state: "up" | "down" | "flat" | "new" | "no_data";
};

const datePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ADMIN_ANALYTICS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ADMIN_ANALYTICS_TIME_ZONE,
  timeZoneName: "longOffset",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit"
});

function parseDateKey(key: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new Error(`Data analitica invalida: ${key}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function keyFromUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function offsetMilliseconds(date: Date) {
  const value = offsetFormatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value || "GMT";
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(value);
  if (!match) return 0;
  const direction = match[1] === "+" ? 1 : -1;
  return direction * (Number(match[2]) * 60 + Number(match[3])) * 60_000;
}

export function saoPauloDateKey(date = new Date()) {
  const parts = datePartsFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Nao foi possivel calcular a data de Sao Paulo.");
  return `${year}-${month}-${day}`;
}

export function saoPauloDateTime(key: string, hour = 0, minute = 0, second = 0) {
  const { year, month, day } = parseDateKey(key);
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let result = new Date(targetUtc);
  for (let pass = 0; pass < 2; pass += 1) {
    result = new Date(targetUtc - offsetMilliseconds(result));
  }
  return result;
}

export function analyticsEventDate(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

export function shiftDateKey(key: string, days: number) {
  const { year, month, day } = parseDateKey(key);
  return keyFromUtcDate(new Date(Date.UTC(year, month - 1, day + days)));
}

function startOfWeekKey(key: string) {
  const dayOfWeek = new Date(`${key}T00:00:00.000Z`).getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return shiftDateKey(key, -daysSinceMonday);
}

function startOfMonthKey(key: string) {
  const { year, month } = parseDateKey(key);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function startOfYearKey(key: string) {
  return `${parseDateKey(key).year}-01-01`;
}

function previousMonthKey(key: string) {
  const { year, month } = parseDateKey(key);
  return keyFromUtcDate(new Date(Date.UTC(year, month - 2, 1)));
}

function nextMonthKey(key: string) {
  const { year, month } = parseDateKey(key);
  return keyFromUtcDate(new Date(Date.UTC(year, month, 1)));
}

function shiftYearKey(key: string, years: number) {
  const { year, month, day } = parseDateKey(key);
  const lastDay = new Date(Date.UTC(year + years, month, 0)).getUTCDate();
  return keyFromUtcDate(new Date(Date.UTC(year + years, month - 1, Math.min(day, lastDay))));
}

function periodStartKey(period: AdminAnalyticsPeriod, todayKey: string) {
  if (period === "week") return startOfWeekKey(todayKey);
  if (period === "month") return startOfMonthKey(todayKey);
  if (period === "year") return startOfYearKey(todayKey);
  return todayKey;
}

function periodEndKey(period: AdminAnalyticsPeriod, startKey: string) {
  if (period === "today") return shiftDateKey(startKey, 1);
  if (period === "week") return shiftDateKey(startKey, 7);
  if (period === "month") return nextMonthKey(startKey);
  return `${parseDateKey(startKey).year + 1}-01-01`;
}

function previousPeriodStartKey(period: AdminAnalyticsPeriod, startKey: string) {
  if (period === "today") return shiftDateKey(startKey, -1);
  if (period === "week") return shiftDateKey(startKey, -7);
  if (period === "month") return previousMonthKey(startKey);
  return `${parseDateKey(startKey).year - 1}-01-01`;
}

export function parseAdminAnalyticsPeriod(value: unknown): AdminAnalyticsPeriod {
  return ADMIN_ANALYTICS_PERIODS.includes(value as AdminAnalyticsPeriod) ? (value as AdminAnalyticsPeriod) : "today";
}

export function parseAdminAnalyticsComparison(value: unknown): AdminAnalyticsComparison {
  return ADMIN_ANALYTICS_COMPARISONS.includes(value as AdminAnalyticsComparison)
    ? (value as AdminAnalyticsComparison)
    : "previous_period";
}

export function adminAnalyticsWindow(
  period: AdminAnalyticsPeriod,
  comparison: AdminAnalyticsComparison,
  now = new Date()
): AdminAnalyticsWindow {
  const todayKey = saoPauloDateKey(now);
  const currentStartKey = periodStartKey(period, todayKey);
  const currentFullEndKey = periodEndKey(period, currentStartKey);
  const currentStart = saoPauloDateTime(currentStartKey);
  const currentFullEnd = saoPauloDateTime(currentFullEndKey);
  const currentEnd = new Date(Math.min(now.getTime(), currentFullEnd.getTime()));
  const elapsed = Math.max(0, currentEnd.getTime() - currentStart.getTime());

  const comparisonStartKey =
    comparison === "previous_year" ? shiftYearKey(currentStartKey, -1) : previousPeriodStartKey(period, currentStartKey);
  const comparisonFullEndKey = periodEndKey(period, comparisonStartKey);
  const comparisonStart = saoPauloDateTime(comparisonStartKey);
  const comparisonFullEnd = saoPauloDateTime(comparisonFullEndKey);
  const comparisonEnd = new Date(Math.min(comparisonStart.getTime() + elapsed, comparisonFullEnd.getTime()));

  return {
    period,
    comparison,
    bucket: period === "today" ? "hour" : period === "year" ? "month" : "day",
    currentStart,
    currentEnd,
    currentStartKey,
    currentEndKey: saoPauloDateKey(new Date(Math.max(currentStart.getTime(), currentEnd.getTime() - 1))),
    comparisonStart,
    comparisonEnd,
    comparisonStartKey,
    comparisonEndKey: saoPauloDateKey(new Date(Math.max(comparisonStart.getTime(), comparisonEnd.getTime() - 1)))
  };
}

export function analyticsChange(current: number, previous: number, previousHasData: boolean): AnalyticsChange {
  const delta = current - previous;
  if (!previousHasData) return { current, previous, delta, percent: null, state: "no_data" };
  if (previous === 0 && current > 0) return { current, previous, delta, percent: null, state: "new" };
  const percent = previous === 0 ? 0 : Math.round((delta / previous) * 1000) / 10;
  return {
    current,
    previous,
    delta,
    percent,
    state: delta > 0 ? "up" : delta < 0 ? "down" : "flat"
  };
}

export function analyticsVisitorRetentionCutoff(now = new Date()) {
  const key = saoPauloDateKey(now);
  const { year, month, day } = parseDateKey(key);
  return analyticsEventDate(keyFromUtcDate(new Date(Date.UTC(year, month - 26, day))));
}
