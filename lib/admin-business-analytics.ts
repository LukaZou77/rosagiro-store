import {
  adminAnalyticsWindow,
  analyticsChange,
  analyticsEventDate,
  parseAdminAnalyticsComparison,
  parseAdminAnalyticsPeriod,
  saoPauloDateKey,
  shiftDateKey,
  type AdminAnalyticsBucket,
  type AdminAnalyticsComparison,
  type AdminAnalyticsPeriod
} from "@/lib/admin-analytics-core";
import { prisma } from "@/lib/db-client";
import { rankProductMetricRows } from "@/lib/admin-product-rankings";

export const BUSINESS_METRIC_KEYS = [
  "visitors",
  "pageViews",
  "createdOrders",
  "paidOrders",
  "paidRevenueCents",
  "whatsappSessions",
  "qualifiedLeads"
] as const;

export type BusinessMetricKey = (typeof BUSINESS_METRIC_KEYS)[number];
export type ProductLeaderboardKey =
  | "views"
  | "addToCartQuantity"
  | "orderedUnits"
  | "orderCount"
  | "paidUnits"
  | "paidRevenueCents";

type WindowMetrics = {
  visitors: number;
  pageViews: number;
  createdOrders: number;
  canceledOrders: number;
  paidOrders: number;
  paidRevenueCents: number;
  whatsappClicks: number;
  whatsappSessions: number;
  qualifiedLeads: number;
  wonLeads: number;
};

type TrendAccumulator = WindowMetrics & { visitorHashes: Set<string>; whatsappSessionHashes: Set<string> };

const hourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23"
});

const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });

function endDateKey(end: Date, start: Date) {
  return saoPauloDateKey(new Date(Math.max(start.getTime(), end.getTime() - 1)));
}

function emptyMetrics(): WindowMetrics {
  return {
    visitors: 0,
    pageViews: 0,
    createdOrders: 0,
    canceledOrders: 0,
    paidOrders: 0,
    paidRevenueCents: 0,
    whatsappClicks: 0,
    whatsappSessions: 0,
    qualifiedLeads: 0,
    wonLeads: 0
  };
}

function emptyTrendAccumulator(): TrendAccumulator {
  return { ...emptyMetrics(), visitorHashes: new Set<string>(), whatsappSessionHashes: new Set<string>() };
}

function hourKey(date: Date) {
  const parts = hourFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}`;
}

function bucketKey(date: Date, bucket: AdminAnalyticsBucket) {
  if (bucket === "hour") return hourKey(date);
  const key = saoPauloDateKey(date);
  return bucket === "month" ? key.slice(0, 7) : key;
}

function eventDateBucket(date: Date, bucket: AdminAnalyticsBucket) {
  const key = date.toISOString().slice(0, 10);
  return bucket === "month" ? key.slice(0, 7) : key;
}

function bucketLabel(key: string, bucket: AdminAnalyticsBucket) {
  if (bucket === "hour") return `${key.slice(-2)}h`;
  if (bucket === "day") return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
  const [year, month] = key.split("-").map(Number);
  return monthLabelFormatter.format(new Date(Date.UTC(year, month - 1, 1))).replace(".", "");
}

function bucketKeys(start: Date, end: Date, bucket: AdminAnalyticsBucket) {
  if (bucket === "hour") {
    const keys: string[] = [];
    let cursor = new Date(start);
    while (cursor < end) {
      keys.push(hourKey(cursor));
      cursor = new Date(cursor.getTime() + 3_600_000);
    }
    return Array.from(new Set(keys));
  }

  const startKey = saoPauloDateKey(start);
  const finalKey = endDateKey(end, start);
  if (bucket === "day") {
    const keys: string[] = [];
    for (let key = startKey; key <= finalKey; key = shiftDateKey(key, 1)) keys.push(key);
    return keys;
  }

  const keys: string[] = [];
  let year = Number(startKey.slice(0, 4));
  let month = Number(startKey.slice(5, 7));
  const finalYear = Number(finalKey.slice(0, 4));
  const finalMonth = Number(finalKey.slice(5, 7));
  while (year < finalYear || (year === finalYear && month <= finalMonth)) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month === 13) {
      year += 1;
      month = 1;
    }
  }
  return keys;
}

async function collectWindowMetrics(start: Date, end: Date): Promise<WindowMetrics> {
  if (end <= start) return emptyMetrics();
  const startEventDate = analyticsEventDate(saoPauloDateKey(start));
  const endEventDate = analyticsEventDate(endDateKey(end, start));
  const [visitorDays, orders, paidPayments, clickEvents, sessionDays, qualifiedLeads, wonLeads] = await Promise.all([
    prisma.analyticsVisitorDay.findMany({
      where: { eventDate: { gte: startEventDate, lte: endEventDate } },
      select: { visitorHash: true, pageViews: true, whatsappClicks: true }
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { status: true }
    }),
    prisma.payment.findMany({
      where: { status: "PAID", paidAt: { gte: start, lt: end } },
      select: { amountCents: true }
    }),
    prisma.whatsAppClickEvent.findMany({
      where: { occurredAt: { gte: start, lt: end } },
      select: { sessionHash: true }
    }),
    prisma.whatsAppSessionDay.findMany({
      where: { firstSeenAt: { gte: start, lt: end } },
      select: { sessionHash: true }
    }),
    prisma.whatsAppLead.count({ where: { qualifiedAt: { gte: start, lt: end } } }),
    prisma.whatsAppLead.count({ where: { wonAt: { gte: start, lt: end } } })
  ]);

  const visitorHashes = new Set(visitorDays.map((row) => row.visitorHash));
  const rawClickTotal = clickEvents.length;
  const accumulatedClicks = visitorDays.reduce((sum, row) => sum + row.whatsappClicks, 0);
  return {
    visitors: visitorHashes.size,
    pageViews: visitorDays.reduce((sum, row) => sum + row.pageViews, 0),
    createdOrders: orders.length,
    canceledOrders: orders.filter((order) => order.status === "CANCELED").length,
    paidOrders: paidPayments.length,
    paidRevenueCents: paidPayments.reduce((sum, payment) => sum + payment.amountCents, 0),
    whatsappClicks: Math.max(rawClickTotal, accumulatedClicks),
    whatsappSessions: new Set(sessionDays.map((session) => session.sessionHash)).size,
    qualifiedLeads,
    wonLeads
  };
}

async function collectTrendWindow(start: Date, end: Date, bucket: AdminAnalyticsBucket) {
  if (end <= start) return [];
  const startEventDate = analyticsEventDate(saoPauloDateKey(start));
  const endEventDate = analyticsEventDate(endDateKey(end, start));
  const usePageViewDetails = bucket === "hour";
  const [visitorRows, orders, payments, clicks, sessions, leads] = await Promise.all([
    usePageViewDetails
      ? prisma.sitePageView.findMany({
          where: { occurredAt: { gte: start, lt: end } },
          select: { occurredAt: true, visitorHash: true }
        })
      : prisma.analyticsVisitorDay.findMany({
          where: { eventDate: { gte: startEventDate, lte: endEventDate } },
          select: { eventDate: true, visitorHash: true, pageViews: true, whatsappClicks: true }
        }),
    prisma.order.findMany({ where: { createdAt: { gte: start, lt: end } }, select: { createdAt: true, status: true } }),
    prisma.payment.findMany({
      where: { status: "PAID", paidAt: { gte: start, lt: end } },
      select: { paidAt: true, amountCents: true }
    }),
    prisma.whatsAppClickEvent.findMany({
      where: { occurredAt: { gte: start, lt: end } },
      select: { occurredAt: true, sessionHash: true }
    }),
    prisma.whatsAppSessionDay.findMany({
      where: { firstSeenAt: { gte: start, lt: end } },
      select: { firstSeenAt: true, sessionHash: true }
    }),
    prisma.whatsAppLead.findMany({
      where: { qualifiedAt: { gte: start, lt: end } },
      select: { qualifiedAt: true, wonAt: true }
    })
  ]);

  const rows = new Map(bucketKeys(start, end, bucket).map((key) => [key, emptyTrendAccumulator()]));

  if (usePageViewDetails) {
    for (const view of visitorRows as Array<{ occurredAt: Date; visitorHash: string }>) {
      const row = rows.get(bucketKey(view.occurredAt, bucket));
      if (!row) continue;
      row.visitorHashes.add(view.visitorHash);
      row.pageViews += 1;
    }
  } else {
    for (const view of visitorRows as Array<{ eventDate: Date; visitorHash: string; pageViews: number; whatsappClicks: number }>) {
      const row = rows.get(eventDateBucket(view.eventDate, bucket));
      if (!row) continue;
      row.visitorHashes.add(view.visitorHash);
      row.pageViews += view.pageViews;
      row.whatsappClicks += view.whatsappClicks;
    }
  }

  for (const order of orders) {
    const row = rows.get(bucketKey(order.createdAt, bucket));
    if (!row) continue;
    row.createdOrders += 1;
    if (order.status === "CANCELED") row.canceledOrders += 1;
  }
  for (const payment of payments) {
    if (!payment.paidAt) continue;
    const row = rows.get(bucketKey(payment.paidAt, bucket));
    if (!row) continue;
    row.paidOrders += 1;
    row.paidRevenueCents += payment.amountCents;
  }
  for (const click of clicks) {
    const row = rows.get(bucketKey(click.occurredAt, bucket));
    if (!row) continue;
    if (usePageViewDetails) row.whatsappClicks += 1;
  }
  for (const session of sessions) {
    const row = rows.get(bucketKey(session.firstSeenAt, bucket));
    if (!row) continue;
    row.whatsappSessionHashes.add(session.sessionHash);
  }
  for (const lead of leads) {
    const row = rows.get(bucketKey(lead.qualifiedAt, bucket));
    if (!row) continue;
    row.qualifiedLeads += 1;
    if (lead.wonAt && lead.wonAt >= start && lead.wonAt < end) row.wonLeads += 1;
  }

  return Array.from(rows.entries()).map(([key, row]) => ({
    key,
    label: bucketLabel(key, bucket),
    visitors: row.visitorHashes.size,
    pageViews: row.pageViews,
    createdOrders: row.createdOrders,
    canceledOrders: row.canceledOrders,
    paidOrders: row.paidOrders,
    paidRevenueCents: row.paidRevenueCents,
    whatsappClicks: row.whatsappClicks,
    whatsappSessions: row.whatsappSessionHashes.size,
    qualifiedLeads: row.qualifiedLeads,
    wonLeads: row.wonLeads
  }));
}

const PRODUCT_LEADERBOARD_KEYS: ProductLeaderboardKey[] = [
  "views",
  "addToCartQuantity",
  "orderedUnits",
  "orderCount",
  "paidUnits",
  "paidRevenueCents"
];

async function productPeriodRows(start: Date, end: Date) {
  const startEventDate = analyticsEventDate(saoPauloDateKey(start));
  const endEventDate = analyticsEventDate(endDateKey(end, start));
  const [groups, snapshots] = await Promise.all([
    prisma.productDailyMetric.groupBy({
      by: ["productKey"],
      where: { eventDate: { gte: startEventDate, lte: endEventDate } },
      _sum: {
        views: true,
        addToCartQuantity: true,
        orderedUnits: true,
        orderCount: true,
        paidUnits: true,
        paidRevenueCents: true
      }
    }),
    prisma.productDailyMetric.findMany({
      where: { eventDate: { gte: startEventDate, lte: endEventDate } },
      orderBy: { eventDate: "desc" },
      select: {
        productKey: true,
        productId: true,
        productSlug: true,
        productName: true,
        brandName: true,
        categoryName: true,
        image: true
      }
    })
  ]);
  const snapshotByKey = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) if (!snapshotByKey.has(snapshot.productKey)) snapshotByKey.set(snapshot.productKey, snapshot);

  return groups.map((group) => ({
    ...snapshotByKey.get(group.productKey)!,
    productKey: group.productKey,
    views: group._sum.views || 0,
    addToCartQuantity: group._sum.addToCartQuantity || 0,
    orderedUnits: group._sum.orderedUnits || 0,
    orderCount: group._sum.orderCount || 0,
    paidUnits: group._sum.paidUnits || 0,
    paidRevenueCents: group._sum.paidRevenueCents || 0
  })).filter((row) => row.productSlug);
}

async function productLeaderboards(currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date) {
  const [currentRows, previousRows] = await Promise.all([
    productPeriodRows(currentStart, currentEnd),
    productPeriodRows(previousStart, previousEnd)
  ]);

  const result = {} as Record<ProductLeaderboardKey, Array<(typeof currentRows)[number] & { rank: number; previousRank: number | null; rankChange: number | null }>>;
  for (const metric of PRODUCT_LEADERBOARD_KEYS) {
    const currentByKey = new Map(currentRows.map((row) => [row.productKey, row]));
    const current = rankProductMetricRows(
      currentRows.map((row) => ({ productKey: row.productKey, value: row[metric], tieBreaker: row.paidRevenueCents }))
    );
    const previousRanks = new Map(
      rankProductMetricRows(
        previousRows.map((row) => ({ productKey: row.productKey, value: row[metric], tieBreaker: row.paidRevenueCents }))
      ).map((row) => [row.productKey, row.rank])
    );
    result[metric] = current
      .slice(0, 10)
      .map((ranked) => {
        const row = currentByKey.get(ranked.productKey)!;
        const previousRank = previousRanks.get(ranked.productKey) || null;
        return { ...row, rank: ranked.rank, previousRank, rankChange: previousRank ? previousRank - ranked.rank : null };
      });
  }
  return result;
}

async function metricStartDates() {
  const [visitor, whatsappSession, order, payment, lead] = await Promise.all([
    prisma.analyticsVisitorDay.findFirst({ orderBy: { eventDate: "asc" }, select: { eventDate: true } }),
    prisma.whatsAppSessionDay.findFirst({ orderBy: { firstSeenAt: "asc" }, select: { firstSeenAt: true } }),
    prisma.order.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.payment.findFirst({ where: { paidAt: { not: null } }, orderBy: { paidAt: "asc" }, select: { paidAt: true } }),
    prisma.whatsAppLead.findFirst({ orderBy: { qualifiedAt: "asc" }, select: { qualifiedAt: true } })
  ]);
  return {
    visitors: visitor?.eventDate || null,
    pageViews: visitor?.eventDate || null,
    whatsappSessions: whatsappSession?.firstSeenAt || null,
    createdOrders: order?.createdAt || null,
    paidOrders: payment?.paidAt || null,
    paidRevenueCents: payment?.paidAt || null,
    qualifiedLeads: lead?.qualifiedAt || null
  } satisfies Record<BusinessMetricKey, Date | null>;
}

function periodLabel(period: AdminAnalyticsPeriod) {
  if (period === "today") return "Hoje";
  if (period === "week") return "Esta semana";
  if (period === "month") return "Este mes";
  return "Este ano";
}

function comparisonLabel(comparison: AdminAnalyticsComparison) {
  return comparison === "previous_year" ? "Mesmo periodo do ano anterior" : "Periodo anterior";
}

export async function getAdminBusinessAnalytics(rawPeriod: unknown, rawComparison: unknown, now = new Date()) {
  const period = parseAdminAnalyticsPeriod(rawPeriod);
  const comparison = parseAdminAnalyticsComparison(rawComparison);
  const window = adminAnalyticsWindow(period, comparison, now);
  const [current, previous, currentTrend, previousTrend, starts, leaderboards] = await Promise.all([
    collectWindowMetrics(window.currentStart, window.currentEnd),
    collectWindowMetrics(window.comparisonStart, window.comparisonEnd),
    collectTrendWindow(window.currentStart, window.currentEnd, window.bucket),
    collectTrendWindow(window.comparisonStart, window.comparisonEnd, window.bucket),
    metricStartDates(),
    productLeaderboards(window.currentStart, window.currentEnd, window.comparisonStart, window.comparisonEnd)
  ]);

  const kpis = Object.fromEntries(
    BUSINESS_METRIC_KEYS.map((key) => [key, analyticsChange(current[key], previous[key], Boolean(starts[key] && starts[key]! < window.comparisonEnd))])
  ) as Record<BusinessMetricKey, ReturnType<typeof analyticsChange>>;

  return {
    period,
    comparison,
    periodLabel: periodLabel(period),
    comparisonLabel: comparisonLabel(comparison),
    window: {
      currentStart: window.currentStart.toISOString(),
      currentEnd: window.currentEnd.toISOString(),
      comparisonStart: window.comparisonStart.toISOString(),
      comparisonEnd: window.comparisonEnd.toISOString()
    },
    current,
    previous,
    kpis,
    trend: currentTrend.map((point, index) => ({
      ...point,
      previous: previousTrend[index] || null
    })),
    funnel: {
      whatsappClickToLeadRate: current.whatsappSessions ? Math.round((current.qualifiedLeads / current.whatsappSessions) * 1000) / 10 : null,
      orderToPaidRate: current.createdOrders ? Math.round((current.paidOrders / current.createdOrders) * 1000) / 10 : null
    },
    leaderboards
  };
}

export async function rebuildAnalyticsPeriodAggregate(
  periodType: "DAY" | "WEEK" | "MONTH" | "YEAR",
  start: Date,
  end: Date
) {
  const metrics = await collectWindowMetrics(start, end);
  const periodStart = analyticsEventDate(saoPauloDateKey(start));
  const periodEnd = analyticsEventDate(endDateKey(end, start));
  return prisma.analyticsPeriodAggregate.upsert({
    where: { periodType_periodStart: { periodType, periodStart } },
    create: { periodType, periodStart, periodEnd, ...metrics, calculatedAt: new Date() },
    update: { periodEnd, ...metrics, calculatedAt: new Date() }
  });
}
