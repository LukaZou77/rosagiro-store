import "server-only";

import { prisma } from "@/lib/db";
import {
  analyticsDateKeys,
  analyticsDeviceType,
  analyticsPercentChange,
  analyticsRetentionCutoff,
  brazilDateKey,
  eventDateFromKey,
  hmacAnalyticsValue,
  isAnalyticsBot,
  normalizeAnalyticsAttribution,
  normalizeAnalyticsIdentifier,
  normalizeAnalyticsPath,
  normalizeReferrerHost,
  parseSiteAnalyticsRange,
  previousBrazilDateKey,
  type SiteAnalyticsRange
} from "@/lib/site-analytics-core";

type PageViewPayload = {
  eventId?: unknown;
  anonymousId?: unknown;
  sessionId?: unknown;
  path?: unknown;
  referrer?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  utmTerm?: unknown;
  utmContent?: unknown;
};

type RequestContext = {
  headers: Headers;
  now?: Date;
};

function safeHeaderText(value: string | null, maxLength: number) {
  if (!value) return null;
  try {
    return decodeURIComponent(value.replace(/\+/g, " ")).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength) || null;
  } catch {
    return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength) || null;
  }
}

function analyticsSecret() {
  const secret = process.env.ANALYTICS_HASH_SECRET || (process.env.NODE_ENV !== "production" ? process.env.SESSION_SECRET : null);
  if (!secret) throw new Error("ANALYTICS_HASH_SECRET nao configurado.");
  return secret;
}

function requestIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || null;
}

function countryCode(headers: Headers) {
  const value = safeHeaderText(headers.get("x-vercel-ip-country"), 2)?.toUpperCase() || null;
  return value && /^[A-Z]{2}$/.test(value) ? value : null;
}

function compactLabel(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

export async function recordSitePageView(payload: PageViewPayload, context: RequestContext) {
  if (context.headers.get("dnt") === "1" || context.headers.get("sec-gpc") === "1") {
    return { ok: true, ignored: true } as const;
  }

  const userAgent = context.headers.get("user-agent") || "";
  if (isAnalyticsBot(userAgent)) return { ok: true, ignored: true } as const;

  const eventId = normalizeAnalyticsIdentifier(payload.eventId);
  const anonymousId = normalizeAnalyticsIdentifier(payload.anonymousId);
  const sessionId = normalizeAnalyticsIdentifier(payload.sessionId);
  const path = normalizeAnalyticsPath(payload.path);
  if (!eventId || !anonymousId || !sessionId || !path) return { ok: false, ignored: false } as const;

  const now = context.now || new Date();
  const secret = analyticsSecret();
  const ip = requestIp(context.headers);
  const ownHost = context.headers.get("x-forwarded-host") || context.headers.get("host");

  try {
    await prisma.sitePageView.create({
      data: {
        eventId,
        eventDate: eventDateFromKey(brazilDateKey(now)),
        visitorHash: hmacAnalyticsValue(secret, anonymousId),
        sessionHash: hmacAnalyticsValue(secret, sessionId),
        ipHash: ip ? hmacAnalyticsValue(secret, ip) : null,
        path,
        referrerHost: normalizeReferrerHost(payload.referrer, ownHost),
        countryCode: countryCode(context.headers),
        regionCode: safeHeaderText(context.headers.get("x-vercel-ip-country-region"), 12)?.toUpperCase() || null,
        city: safeHeaderText(context.headers.get("x-vercel-ip-city"), 80),
        deviceType: analyticsDeviceType(userAgent),
        utmSource: normalizeAnalyticsAttribution(payload.utmSource),
        utmMedium: normalizeAnalyticsAttribution(payload.utmMedium),
        utmCampaign: normalizeAnalyticsAttribution(payload.utmCampaign),
        utmTerm: normalizeAnalyticsAttribution(payload.utmTerm),
        utmContent: normalizeAnalyticsAttribution(payload.utmContent),
        occurredAt: now
      }
    });
    return { ok: true, ignored: false } as const;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return { ok: true, ignored: true } as const;
    }
    throw error;
  }
}

function trendLabel(key: string) {
  const [, month, day] = key.split("-");
  return `${day}/${month}`;
}

type SessionSummary = {
  sessionHash: string;
  visitorHash: string;
  countryCode: string | null;
  regionCode: string | null;
  city: string | null;
  deviceType: string;
  referrerHost: string | null;
  pages: Set<string>;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

export async function getAdminOperationsDashboard(rawRange: unknown) {
  const range = parseSiteAnalyticsRange(rawRange);
  const now = new Date();
  const dateKeys = analyticsDateKeys(range, now);
  const dateKeySet = new Set(dateKeys);
  const firstEventDate = eventDateFromKey(dateKeys[0]);
  const lastEventDate = eventDateFromKey(dateKeys[dateKeys.length - 1]);
  const approximateStart = new Date(now.getTime() - (range + 2) * 86_400_000);

  const [pageViews, orders, paidPayments, recentOrders, productCount, outOfStockCount, outOfStockProducts, pendingOrders] = await Promise.all([
    prisma.sitePageView.findMany({
      where: { eventDate: { gte: firstEventDate, lte: lastEventDate } },
      select: {
        eventDate: true,
        visitorHash: true,
        sessionHash: true,
        path: true,
        referrerHost: true,
        countryCode: true,
        regionCode: true,
        city: true,
        deviceType: true,
        occurredAt: true
      },
      orderBy: { occurredAt: "desc" }
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: approximateStart } },
      select: { id: true, createdAt: true }
    }),
    prisma.payment.findMany({
      where: { status: "PAID", paidAt: { gte: approximateStart } },
      select: { amountCents: true, paidAt: true }
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        status: true,
        totalCents: true,
        createdAt: true,
        payment: { select: { status: true } },
        _count: { select: { items: true } }
      }
    }),
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.product.count({
      where: { active: true, deletedAt: null, OR: [{ inventory: null }, { inventory: { quantity: 0 } }] }
    }),
    prisma.product.findMany({
      where: { active: true, deletedAt: null, OR: [{ inventory: null }, { inventory: { quantity: 0 } }] },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { slug: true, name: true, image: true, brand: { select: { name: true } } }
    }),
    prisma.order.count({ where: { status: "PENDING_PAYMENT" } })
  ]);

  const daily = new Map(
    dateKeys.map((key) => [key, { date: key, label: trendLabel(key), visitors: new Set<string>(), pageViews: 0, orders: 0, revenueCents: 0 }])
  );
  const sessions = new Map<string, SessionSummary>();
  const locations = new Map<string, { countryCode: string | null; regionCode: string | null; city: string | null; views: number; visitors: Set<string> }>();

  for (const view of pageViews) {
    const key = view.eventDate.toISOString().slice(0, 10);
    const day = daily.get(key);
    if (!day) continue;
    day.pageViews += 1;
    day.visitors.add(view.visitorHash);

    const session = sessions.get(view.sessionHash);
    if (session) {
      session.pages.add(view.path);
      if (view.occurredAt < session.firstSeenAt) session.firstSeenAt = view.occurredAt;
      if (view.occurredAt > session.lastSeenAt) session.lastSeenAt = view.occurredAt;
      if (!session.city && view.city) session.city = view.city;
      if (!session.regionCode && view.regionCode) session.regionCode = view.regionCode;
      if (!session.countryCode && view.countryCode) session.countryCode = view.countryCode;
    } else {
      sessions.set(view.sessionHash, {
        sessionHash: view.sessionHash,
        visitorHash: view.visitorHash,
        countryCode: view.countryCode,
        regionCode: view.regionCode,
        city: view.city,
        deviceType: view.deviceType,
        referrerHost: view.referrerHost,
        pages: new Set([view.path]),
        firstSeenAt: view.occurredAt,
        lastSeenAt: view.occurredAt
      });
    }

    const locationKey = `${view.countryCode || "--"}|${view.regionCode || "--"}|${view.city || "--"}`;
    const location = locations.get(locationKey) || {
      countryCode: view.countryCode,
      regionCode: view.regionCode,
      city: view.city,
      views: 0,
      visitors: new Set<string>()
    };
    location.views += 1;
    location.visitors.add(view.visitorHash);
    locations.set(locationKey, location);
  }

  for (const order of orders) {
    const key = brazilDateKey(order.createdAt);
    if (dateKeySet.has(key)) daily.get(key)!.orders += 1;
  }
  for (const payment of paidPayments) {
    if (!payment.paidAt) continue;
    const key = brazilDateKey(payment.paidAt);
    if (dateKeySet.has(key)) daily.get(key)!.revenueCents += payment.amountCents;
  }

  const todayKey = brazilDateKey(now);
  const yesterdayKey = previousBrazilDateKey(now);
  const today = daily.get(todayKey)!;
  const yesterday = daily.get(yesterdayKey) || { visitors: new Set<string>(), pageViews: 0, orders: 0, revenueCents: 0 };
  const trend = Array.from(daily.values()).map((day) => ({
    date: day.date,
    label: day.label,
    visitors: day.visitors.size,
    pageViews: day.pageViews,
    orders: day.orders,
    revenueCents: day.revenueCents
  }));

  return {
    range: range as SiteAnalyticsRange,
    kpis: {
      visitors: { value: today.visitors.size, change: analyticsPercentChange(today.visitors.size, yesterday.visitors.size) },
      pageViews: { value: today.pageViews, change: analyticsPercentChange(today.pageViews, yesterday.pageViews) },
      orders: { value: today.orders, change: analyticsPercentChange(today.orders, yesterday.orders) },
      revenueCents: { value: today.revenueCents, change: analyticsPercentChange(today.revenueCents, yesterday.revenueCents) }
    },
    trend,
    locations: Array.from(locations.values())
      .sort((a, b) => b.visitors.size - a.visitors.size || b.views - a.views)
      .slice(0, 8)
      .map((location) => ({
        label: [location.city, location.regionCode, location.countryCode].filter(Boolean).join(", ") || "Local não identificado",
        visitors: location.visitors.size,
        pageViews: location.views
      })),
    recentSessions: Array.from(sessions.values())
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
      .slice(0, 10)
      .map((session) => ({
        id: `VIS-${session.visitorHash.slice(0, 8).toUpperCase()}`,
        country: compactLabel(session.countryCode, "--"),
        region: compactLabel(session.regionCode, "--"),
        city: compactLabel(session.city, "Não identificada"),
        deviceType: session.deviceType,
        source: session.referrerHost || "Direto",
        pageCount: session.pages.size,
        firstSeenAt: session.firstSeenAt.toISOString(),
        lastSeenAt: session.lastSeenAt.toISOString()
      })),
    operations: {
      pendingOrders,
      productCount,
      outOfStockCount,
      outOfStockProducts,
      recentOrders: recentOrders.map((order) => ({
        ...order,
        createdAt: order.createdAt.toISOString()
      }))
    }
  };
}

export async function deleteExpiredSiteAnalytics(now = new Date()) {
  const cutoff = analyticsRetentionCutoff(now);
  return prisma.sitePageView.deleteMany({ where: { occurredAt: { lt: cutoff } } });
}
