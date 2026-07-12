import "server-only";

import { prisma } from "@/lib/db";
import { eventDateFromKey, brazilDateKey } from "@/lib/site-analytics-core";

type ProductMetricSeed = {
  productKey: string;
  productId: string | null;
  productSlug: string;
  productName: string;
  brandName: string;
  categoryName: string;
  image: string;
  units: number;
  revenueCents: number;
};

function groupOrderItems(items: Array<{
  productId: string | null;
  productSlug: string;
  productName: string;
  productBrand: string;
  productImage: string;
  quantity: number;
  lineTotalCents: number;
  product: { category: { label: string } } | null;
}>) {
  const grouped = new Map<string, ProductMetricSeed>();
  for (const item of items) {
    const productKey = item.productId || `slug:${item.productSlug}`;
    const current = grouped.get(productKey);
    if (current) {
      current.units += item.quantity;
      current.revenueCents += item.lineTotalCents;
      continue;
    }
    grouped.set(productKey, {
      productKey,
      productId: item.productId,
      productSlug: item.productSlug,
      productName: item.productName,
      brandName: item.productBrand,
      categoryName: item.product?.category.label || "Sem categoria",
      image: item.productImage,
      units: item.quantity,
      revenueCents: item.lineTotalCents
    });
  }
  return Array.from(grouped.values());
}

async function orderMetricSeed(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      createdAt: true,
      payment: { select: { status: true, paidAt: true } },
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
  });
}

function baseCreate(eventDate: Date, seed: ProductMetricSeed) {
  return {
    eventDate,
    productKey: seed.productKey,
    productId: seed.productId,
    productSlug: seed.productSlug,
    productName: seed.productName,
    brandName: seed.brandName,
    categoryName: seed.categoryName,
    image: seed.image
  };
}

export async function recordCreatedOrderProductMetrics(orderId: string, direction: 1 | -1 = 1) {
  const order = await orderMetricSeed(orderId);
  if (!order) return;
  const eventDate = eventDateFromKey(brazilDateKey(order.createdAt));
  const seeds = groupOrderItems(order.items);
  await prisma.$transaction(
    seeds.map((seed) =>
      prisma.productDailyMetric.upsert({
        where: { eventDate_productKey: { eventDate, productKey: seed.productKey } },
        create: {
          ...baseCreate(eventDate, seed),
          orderedUnits: Math.max(0, seed.units * direction),
          orderCount: direction > 0 ? 1 : 0
        },
        update: {
          productId: seed.productId,
          productSlug: seed.productSlug,
          productName: seed.productName,
          brandName: seed.brandName,
          categoryName: seed.categoryName,
          image: seed.image,
          orderedUnits: { increment: seed.units * direction },
          orderCount: { increment: direction }
        }
      })
    )
  );
}

export async function recordPaidOrderProductMetrics(orderId: string) {
  const order = await orderMetricSeed(orderId);
  if (!order?.payment?.paidAt || order.payment.status !== "PAID") return;
  const eventDate = eventDateFromKey(brazilDateKey(order.payment.paidAt));
  const seeds = groupOrderItems(order.items);
  await prisma.$transaction(
    seeds.map((seed) =>
      prisma.productDailyMetric.upsert({
        where: { eventDate_productKey: { eventDate, productKey: seed.productKey } },
        create: {
          ...baseCreate(eventDate, seed),
          paidUnits: seed.units,
          paidOrderCount: 1,
          paidRevenueCents: seed.revenueCents
        },
        update: {
          productId: seed.productId,
          productSlug: seed.productSlug,
          productName: seed.productName,
          brandName: seed.brandName,
          categoryName: seed.categoryName,
          image: seed.image,
          paidUnits: { increment: seed.units },
          paidOrderCount: { increment: 1 },
          paidRevenueCents: { increment: seed.revenueCents }
        }
      })
    )
  );
}
