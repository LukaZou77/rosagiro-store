import { rebuildAnalyticsPeriodAggregate } from "@/lib/admin-business-analytics";
import {
  analyticsEventDate,
  saoPauloDateKey,
  saoPauloDateTime,
  shiftDateKey
} from "@/lib/admin-analytics-core";
import { prisma } from "@/lib/db-client";
import { analyticsRetentionCutoff } from "@/lib/site-analytics-core";

type ProductRollup = {
  eventDate: Date;
  productKey: string;
  productId: string | null;
  productSlug: string;
  productName: string;
  brandName: string;
  categoryName: string;
  image: string;
  views: number;
  addToCartQuantity: number;
  orderedUnits: number;
  orderCount: number;
  paidUnits: number;
  paidOrderCount: number;
  paidRevenueCents: number;
};

function chunks<T>(rows: T[], size = 400) {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) result.push(rows.slice(index, index + size));
  return result;
}

export async function backfillAnalyticsVisitorDays() {
  const [viewGroups, clickGroups, sessionGroups] = await Promise.all([
    prisma.sitePageView.groupBy({
      by: ["eventDate", "visitorHash"],
      _count: { id: true },
      _min: { occurredAt: true },
      _max: { occurredAt: true }
    }),
    prisma.whatsAppClickEvent.groupBy({
      by: ["eventDate", "visitorHash"],
      _count: { id: true },
      _min: { occurredAt: true },
      _max: { occurredAt: true }
    }),
    prisma.whatsAppClickEvent.groupBy({
      by: ["eventDate", "visitorHash", "sessionHash"],
      _min: { occurredAt: true }
    })
  ]);
  const rows = new Map<string, {
    eventDate: Date;
    visitorHash: string;
    pageViews: number;
    whatsappClicks: number;
    firstSeenAt: Date;
    lastSeenAt: Date;
  }>();

  for (const group of viewGroups) {
    const key = `${group.eventDate.toISOString().slice(0, 10)}:${group.visitorHash}`;
    rows.set(key, {
      eventDate: group.eventDate,
      visitorHash: group.visitorHash,
      pageViews: group._count.id,
      whatsappClicks: 0,
      firstSeenAt: group._min.occurredAt || group.eventDate,
      lastSeenAt: group._max.occurredAt || group.eventDate
    });
  }
  for (const group of clickGroups) {
    const key = `${group.eventDate.toISOString().slice(0, 10)}:${group.visitorHash}`;
    const current = rows.get(key);
    const firstSeenAt = group._min.occurredAt || group.eventDate;
    const lastSeenAt = group._max.occurredAt || group.eventDate;
    if (current) {
      current.whatsappClicks = group._count.id;
      if (firstSeenAt < current.firstSeenAt) current.firstSeenAt = firstSeenAt;
      if (lastSeenAt > current.lastSeenAt) current.lastSeenAt = lastSeenAt;
    } else {
      rows.set(key, {
        eventDate: group.eventDate,
        visitorHash: group.visitorHash,
        pageViews: 0,
        whatsappClicks: group._count.id,
        firstSeenAt,
        lastSeenAt
      });
    }
  }

  for (const batch of chunks(Array.from(rows.values()))) {
    await prisma.$transaction(
      batch.map((row) =>
        prisma.analyticsVisitorDay.upsert({
          where: { eventDate_visitorHash: { eventDate: row.eventDate, visitorHash: row.visitorHash } },
          create: row,
          update: {
            pageViews: row.pageViews,
            whatsappClicks: row.whatsappClicks,
            firstSeenAt: row.firstSeenAt,
            lastSeenAt: row.lastSeenAt
          }
        })
      )
    );
  }
  for (const batch of chunks(sessionGroups)) {
    await prisma.whatsAppSessionDay.createMany({
      data: batch.map((group) => ({
        eventDate: group.eventDate,
        visitorHash: group.visitorHash,
        sessionHash: group.sessionHash,
        firstSeenAt: group._min.occurredAt || group.eventDate
      })),
      skipDuplicates: true
    });
  }
  return rows.size;
}

function productRollupRow(seed: {
  eventDate: Date;
  productKey: string;
  productId: string | null;
  productSlug: string;
  productName: string;
  brandName: string;
  categoryName: string;
  image: string;
}) {
  return {
    ...seed,
    views: 0,
    addToCartQuantity: 0,
    orderedUnits: 0,
    orderCount: 0,
    paidUnits: 0,
    paidOrderCount: 0,
    paidRevenueCents: 0
  } satisfies ProductRollup;
}

export async function rebuildProductDailyMetrics(from?: Date) {
  const eventDateFilter = from ? { gte: analyticsEventDate(saoPauloDateKey(from)) } : undefined;
  const dateTimeFilter = from ? { gte: from } : undefined;
  const [events, orders, payments] = await Promise.all([
    prisma.productAnalyticsEvent.findMany({
      where: eventDateFilter ? { eventDate: eventDateFilter } : undefined,
      select: {
        eventDate: true,
        eventType: true,
        quantity: true,
        productId: true,
        productSlug: true,
        product: {
          select: {
            name: true,
            image: true,
            brand: { select: { name: true } },
            category: { select: { label: true } }
          }
        }
      }
    }),
    prisma.order.findMany({
      where: {
        status: { not: "CANCELED" },
        ...(dateTimeFilter ? { createdAt: dateTimeFilter } : {})
      },
      select: {
        createdAt: true,
        items: {
          select: {
            productId: true,
            productSlug: true,
            productName: true,
            productBrand: true,
            productImage: true,
            quantity: true,
            product: { select: { category: { select: { label: true } } } }
          }
        }
      }
    }),
    prisma.payment.findMany({
      where: { status: "PAID", paidAt: dateTimeFilter || { not: null } },
      select: {
        paidAt: true,
        order: {
          select: {
            items: {
              select: {
                productId: true,
                productSlug: true,
                productName: true,
                productBrand: true,
                productImage: true,
                quantity: true,
                lineTotalCents: true,
                product: { select: { category: { select: { label: true } } } }
              }
            }
          }
        }
      }
    })
  ]);

  const metrics = new Map<string, ProductRollup>();
  const getRow = (seed: Parameters<typeof productRollupRow>[0]) => {
    const mapKey = `${seed.eventDate.toISOString().slice(0, 10)}:${seed.productKey}`;
    const existing = metrics.get(mapKey);
    if (existing) return existing;
    const next = productRollupRow(seed);
    metrics.set(mapKey, next);
    return next;
  };

  for (const event of events) {
    const row = getRow({
      eventDate: event.eventDate,
      productKey: event.productId,
      productId: event.productId,
      productSlug: event.productSlug,
      productName: event.product.name,
      brandName: event.product.brand.name,
      categoryName: event.product.category.label,
      image: event.product.image
    });
    if (event.eventType === "PRODUCT_VIEW") row.views += event.quantity;
    if (event.eventType === "ADD_TO_CART") row.addToCartQuantity += event.quantity;
  }

  for (const order of orders) {
    const eventDate = analyticsEventDate(saoPauloDateKey(order.createdAt));
    const seen = new Set<string>();
    for (const item of order.items) {
      const productKey = item.productId || `slug:${item.productSlug}`;
      const row = getRow({
        eventDate,
        productKey,
        productId: item.productId,
        productSlug: item.productSlug,
        productName: item.productName,
        brandName: item.productBrand,
        categoryName: item.product?.category.label || "Sem categoria",
        image: item.productImage
      });
      row.orderedUnits += item.quantity;
      if (!seen.has(productKey)) {
        row.orderCount += 1;
        seen.add(productKey);
      }
    }
  }

  for (const payment of payments) {
    if (!payment.paidAt) continue;
    const eventDate = analyticsEventDate(saoPauloDateKey(payment.paidAt));
    const seen = new Set<string>();
    for (const item of payment.order.items) {
      const productKey = item.productId || `slug:${item.productSlug}`;
      const row = getRow({
        eventDate,
        productKey,
        productId: item.productId,
        productSlug: item.productSlug,
        productName: item.productName,
        brandName: item.productBrand,
        categoryName: item.product?.category.label || "Sem categoria",
        image: item.productImage
      });
      row.paidUnits += item.quantity;
      row.paidRevenueCents += item.lineTotalCents;
      if (!seen.has(productKey)) {
        row.paidOrderCount += 1;
        seen.add(productKey);
      }
    }
  }

  const operations = [
    prisma.productDailyMetric.deleteMany(from ? { where: { eventDate: { gte: analyticsEventDate(saoPauloDateKey(from)) } } } : undefined),
    ...chunks(Array.from(metrics.values())).map((batch) => prisma.productDailyMetric.createMany({ data: batch }))
  ];
  await prisma.$transaction(operations);
  return metrics.size;
}

function weekStartKey(key: string) {
  const weekday = new Date(`${key}T00:00:00.000Z`).getUTCDay();
  return shiftDateKey(key, -((weekday + 6) % 7));
}

function monthStartKey(key: string) {
  return `${key.slice(0, 7)}-01`;
}

function nextMonthStartKey(key: string) {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

function yearStartKey(key: string) {
  return `${key.slice(0, 4)}-01-01`;
}

export async function rebuildAnalyticsPeriodAggregates(now = new Date(), from?: Date) {
  const todayKey = saoPauloDateKey(now);
  const earliestRows = await Promise.all([
    prisma.analyticsVisitorDay.findFirst({ orderBy: { eventDate: "asc" }, select: { eventDate: true } }),
    prisma.order.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.payment.findFirst({ where: { paidAt: { not: null } }, orderBy: { paidAt: "asc" }, select: { paidAt: true } }),
    prisma.whatsAppLead.findFirst({ orderBy: { qualifiedAt: "asc" }, select: { qualifiedAt: true } })
  ]);
  const earliestKey = earliestRows
    .map((row) => row && ("eventDate" in row ? row.eventDate : "createdAt" in row ? row.createdAt : "paidAt" in row ? row.paidAt : row.qualifiedAt))
    .filter((date): date is Date => Boolean(date))
    .map((date) => saoPauloDateKey(date))
    .sort()[0] || todayKey;

  const requestedKey = from ? saoPauloDateKey(from) : earliestKey;
  const rebuildStartKey = requestedKey > earliestKey ? requestedKey : earliestKey;
  const dayKeys: string[] = [];
  for (let key = rebuildStartKey; key <= todayKey; key = shiftDateKey(key, 1)) dayKeys.push(key);
  for (const key of dayKeys) {
    const start = saoPauloDateTime(key);
    const fullEnd = saoPauloDateTime(shiftDateKey(key, 1));
    await rebuildAnalyticsPeriodAggregate("DAY", start, key === todayKey ? now : fullEnd);
  }

  const weekKeys = Array.from(new Set(dayKeys.map(weekStartKey)));
  for (const key of weekKeys) {
    const start = saoPauloDateTime(key);
    const fullEnd = saoPauloDateTime(shiftDateKey(key, 7));
    await rebuildAnalyticsPeriodAggregate("WEEK", start, fullEnd > now ? now : fullEnd);
  }

  const monthKeys = Array.from(new Set(dayKeys.map(monthStartKey)));
  for (const key of monthKeys) {
    const start = saoPauloDateTime(key);
    const fullEnd = saoPauloDateTime(nextMonthStartKey(key));
    await rebuildAnalyticsPeriodAggregate("MONTH", start, fullEnd > now ? now : fullEnd);
  }

  const yearKeys = Array.from(new Set(dayKeys.map(yearStartKey)));
  for (const key of yearKeys) {
    const start = saoPauloDateTime(key);
    const fullEnd = saoPauloDateTime(`${Number(key.slice(0, 4)) + 1}-01-01`);
    await rebuildAnalyticsPeriodAggregate("YEAR", start, fullEnd > now ? now : fullEnd);
  }

  return { days: dayKeys.length, weeks: weekKeys.length, months: monthKeys.length, years: yearKeys.length };
}

export async function runAnalyticsRollup(options: { fullProductBackfill?: boolean; now?: Date } = {}) {
  const now = options.now || new Date();
  const visitorDays = await backfillAnalyticsVisitorDays();
  const productMetrics = await rebuildProductDailyMetrics(options.fullProductBackfill ? undefined : analyticsRetentionCutoff(now));
  const periods = await rebuildAnalyticsPeriodAggregates(
    now,
    options.fullProductBackfill ? undefined : analyticsRetentionCutoff(now)
  );
  return { visitorDays, productMetrics, periods };
}
