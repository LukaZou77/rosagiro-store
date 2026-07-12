import "server-only";

import { prisma } from "@/lib/db";
import { analyticsHashSecret } from "@/lib/site-analytics";
import { brazilDateKey, eventDateFromKey, hmacAnalyticsValue } from "@/lib/site-analytics-core";

export type ProductAnalyticsEventType = "PRODUCT_VIEW" | "ADD_TO_CART";
export type ProductAnalyticsRange = "7d" | "30d" | "90d";

type ProductEventInput = {
  type: ProductAnalyticsEventType;
  slug: string;
  skuId?: string | null;
  quantity?: number;
  anonymousId: string;
};

export type ProductAnalyticsRow = {
  productId: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  image: string;
  views: number;
  addToCartQuantity: number;
  paidUnits: number;
  revenueCents: number;
};

export function normalizeAnalyticsRange(value: unknown): ProductAnalyticsRange {
  return value === "7d" || value === "90d" ? value : "30d";
}

export function rangeStartDate(range: ProductAnalyticsRange) {
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function eventDateForNow(now = new Date()) {
  return eventDateFromKey(brazilDateKey(now));
}

export function cleanAnonymousId(value: unknown) {
  const id = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{16,80}$/.test(id) ? id : "";
}

function safeQuantity(value: unknown) {
  return Math.max(1, Math.min(99, Math.floor(Number(value) || 1)));
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function recordProductAnalyticsEvent(input: ProductEventInput) {
  const anonymousId = cleanAnonymousId(input.anonymousId);
  const slug = String(input.slug || "").trim();
  const quantity = safeQuantity(input.quantity);

  if (!anonymousId || !slug) return { ok: false, reason: "invalid_payload" as const };
  if (input.type !== "PRODUCT_VIEW" && input.type !== "ADD_TO_CART") {
    return { ok: false, reason: "invalid_type" as const };
  }

  const product = await prisma.product.findFirst({
    where: { slug, active: true, deletedAt: null },
    include: {
      brand: { select: { name: true } },
      category: { select: { label: true } },
      skus: { select: { id: true, code: true, active: true } }
    }
  });
  if (!product) return { ok: false, reason: "product_not_found" as const };

  const selectedSku = input.skuId ? product.skus.find((sku) => sku.id === input.skuId && sku.active) : null;
  const eventDate = eventDateForNow();
  const dayKey = eventDate.toISOString().slice(0, 10);
  const anonymousHash = hmacAnalyticsValue(analyticsHashSecret(), anonymousId);
  const dedupeKey =
    input.type === "PRODUCT_VIEW"
      ? `PRODUCT_VIEW:${product.id}:${selectedSku?.id || "product"}:${anonymousHash}:${dayKey}`
      : null;

  try {
    await prisma.$transaction([
      prisma.productAnalyticsEvent.create({
        data: {
          eventType: input.type,
          eventDate,
          dedupeKey,
          anonymousId: anonymousHash,
          productId: product.id,
          productSkuId: selectedSku?.id || null,
          productSlug: product.slug,
          productSkuCode: selectedSku?.code || null,
          quantity
        }
      }),
      prisma.productDailyMetric.upsert({
        where: { eventDate_productKey: { eventDate, productKey: product.id } },
        create: {
          eventDate,
          productKey: product.id,
          productId: product.id,
          productSlug: product.slug,
          productName: product.name,
          brandName: product.brand.name,
          categoryName: product.category.label,
          image: product.image,
          views: input.type === "PRODUCT_VIEW" ? quantity : 0,
          addToCartQuantity: input.type === "ADD_TO_CART" ? quantity : 0
        },
        update: {
          productSlug: product.slug,
          productName: product.name,
          brandName: product.brand.name,
          categoryName: product.category.label,
          image: product.image,
          views: input.type === "PRODUCT_VIEW" ? { increment: quantity } : undefined,
          addToCartQuantity: input.type === "ADD_TO_CART" ? { increment: quantity } : undefined
        }
      })
    ]);
  } catch (error) {
    if (dedupeKey && isUniqueConstraintError(error)) return { ok: true, deduped: true as const };
    throw error;
  }

  return { ok: true, deduped: false as const };
}

function emptyRow(product: {
  id: string;
  slug: string;
  name: string;
  image: string;
  brand: { name: string };
  category: { label: string };
}): ProductAnalyticsRow {
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand.name,
    category: product.category.label,
    image: product.image,
    views: 0,
    addToCartQuantity: 0,
    paidUnits: 0,
    revenueCents: 0
  };
}

export async function getProductAnalyticsDashboard(range: ProductAnalyticsRange) {
  const from = rangeStartDate(range);

  const [eventGroups, paidGroups] = await Promise.all([
    prisma.productAnalyticsEvent.groupBy({
      by: ["productId", "eventType"],
      where: { eventDate: { gte: from } },
      _sum: { quantity: true }
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        productId: { not: null },
        order: {
          status: "PAID",
          payment: { is: { paidAt: { gte: from } } }
        }
      },
      _sum: { quantity: true, lineTotalCents: true }
    })
  ]);

  const productIds = Array.from(
    new Set([
      ...eventGroups.map((group) => group.productId),
      ...paidGroups.map((group) => group.productId).filter((id): id is string => Boolean(id))
    ])
  );

  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          slug: true,
          name: true,
          image: true,
          brand: { select: { name: true } },
          category: { select: { label: true } }
        }
      })
    : [];

  const rows = new Map(products.map((product) => [product.id, emptyRow(product)]));

  for (const group of eventGroups) {
    const row = rows.get(group.productId);
    if (!row) continue;
    const quantity = group._sum.quantity || 0;
    if (group.eventType === "PRODUCT_VIEW") row.views += quantity;
    if (group.eventType === "ADD_TO_CART") row.addToCartQuantity += quantity;
  }

  for (const group of paidGroups) {
    if (!group.productId) continue;
    const row = rows.get(group.productId);
    if (!row) continue;
    row.paidUnits += group._sum.quantity || 0;
    row.revenueCents += group._sum.lineTotalCents || 0;
  }

  const productRows = Array.from(rows.values()).sort((a, b) => {
    if (b.revenueCents !== a.revenueCents) return b.revenueCents - a.revenueCents;
    if (b.paidUnits !== a.paidUnits) return b.paidUnits - a.paidUnits;
    if (b.addToCartQuantity !== a.addToCartQuantity) return b.addToCartQuantity - a.addToCartQuantity;
    return b.views - a.views;
  });

  return {
    totals: {
      views: productRows.reduce((sum, row) => sum + row.views, 0),
      addToCartQuantity: productRows.reduce((sum, row) => sum + row.addToCartQuantity, 0),
      paidUnits: productRows.reduce((sum, row) => sum + row.paidUnits, 0),
      revenueCents: productRows.reduce((sum, row) => sum + row.revenueCents, 0)
    },
    rows: productRows
  };
}
