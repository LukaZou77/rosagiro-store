import "server-only";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import {
  analyticsDateKeys,
  analyticsDeviceType,
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
  type SiteAnalyticsRange
} from "@/lib/site-analytics-core";
import { analyticsVisitorRetentionCutoff } from "@/lib/admin-analytics-core";

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

export function analyticsHashSecret() {
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
  const secret = analyticsHashSecret();
  const ip = requestIp(context.headers);
  const ownHost = context.headers.get("x-forwarded-host") || context.headers.get("host");
  const eventDate = eventDateFromKey(brazilDateKey(now));
  const visitorHash = hmacAnalyticsValue(secret, anonymousId);
  const sessionHash = hmacAnalyticsValue(secret, sessionId);

  try {
    await prisma.$transaction([
      prisma.sitePageView.create({
        data: {
          eventId,
          eventDate,
          visitorHash,
          sessionHash,
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
      }),
      prisma.analyticsVisitorDay.upsert({
        where: { eventDate_visitorHash: { eventDate, visitorHash } },
        create: { eventDate, visitorHash, pageViews: 1, firstSeenAt: now, lastSeenAt: now },
        update: { pageViews: { increment: 1 }, lastSeenAt: now }
      })
    ]);
    return { ok: true, ignored: false } as const;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return { ok: true, ignored: true } as const;
    }
    throw error;
  }
}

async function calculateAdminOperationsDashboard(range: SiteAnalyticsRange) {
  const now = new Date();
  const dateKeys = analyticsDateKeys(range, now);
  const firstEventDate = eventDateFromKey(dateKeys[0]);
  const lastEventDate = eventDateFromKey(dateKeys[dateKeys.length - 1]);

  const [locationRows, recentOrders, productCount, outOfStockCount, outOfStockProducts, pendingOrders] = await Promise.all([
    prisma.sitePageView.groupBy({
      by: ["countryCode", "regionCode", "city", "visitorHash"],
      where: { eventDate: { gte: firstEventDate, lte: lastEventDate } },
      _count: { id: true }
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

  const locations = new Map<string, { countryCode: string | null; regionCode: string | null; city: string | null; views: number; visitors: Set<string> }>();

  for (const view of locationRows) {
    const locationKey = `${view.countryCode || "--"}|${view.regionCode || "--"}|${view.city || "--"}`;
    const location = locations.get(locationKey) || {
      countryCode: view.countryCode,
      regionCode: view.regionCode,
      city: view.city,
      views: 0,
      visitors: new Set<string>()
    };
    location.views += view._count.id;
    location.visitors.add(view.visitorHash);
    locations.set(locationKey, location);
  }

  return {
    available: true as const,
    range,
    locations: Array.from(locations.values())
      .sort((a, b) => b.visitors.size - a.visitors.size || b.views - a.views)
      .slice(0, 8)
      .map((location) => ({
        label: [location.city, location.regionCode, location.countryCode].filter(Boolean).join(", ") || "Local não identificado",
        visitors: location.visitors.size,
        pageViews: location.views
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

const getCachedAdminOperationsDashboard = unstable_cache(
  async (range: SiteAnalyticsRange) => calculateAdminOperationsDashboard(range),
  ["admin-operations-dashboard-v2"],
  { revalidate: 15 }
);

export async function getAdminOperationsDashboard(rawRange: unknown) {
  const range = parseSiteAnalyticsRange(rawRange);
  try {
    return await getCachedAdminOperationsDashboard(range);
  } catch (error) {
    console.error("[admin-operations] dashboard snapshot unavailable", {
      range,
      message: error instanceof Error ? error.message : String(error)
    });
    return {
      available: false as const,
      range,
      locations: [],
      operations: {
        pendingOrders: 0,
        productCount: 0,
        outOfStockCount: 0,
        outOfStockProducts: [],
        recentOrders: []
      }
    };
  }
}

export async function deleteExpiredSiteAnalytics(now = new Date()) {
  const rawCutoff = analyticsRetentionCutoff(now);
  const visitorCutoff = analyticsVisitorRetentionCutoff(now);
  const [pageViews, whatsappClicks, productEvents, visitorDays, whatsappSessionDays] = await prisma.$transaction([
    prisma.sitePageView.deleteMany({ where: { occurredAt: { lt: rawCutoff } } }),
    prisma.whatsAppClickEvent.deleteMany({ where: { occurredAt: { lt: rawCutoff } } }),
    prisma.productAnalyticsEvent.deleteMany({ where: { createdAt: { lt: rawCutoff } } }),
    prisma.analyticsVisitorDay.deleteMany({ where: { eventDate: { lt: visitorCutoff } } }),
    prisma.whatsAppSessionDay.deleteMany({ where: { eventDate: { lt: visitorCutoff } } })
  ]);
  return {
    pageViews: pageViews.count,
    whatsappClicks: whatsappClicks.count,
    productEvents: productEvents.count,
    visitorDays: visitorDays.count,
    whatsappSessionDays: whatsappSessionDays.count
  };
}
