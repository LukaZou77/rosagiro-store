import "server-only";

import { prisma } from "@/lib/db";
import {
  brazilDateKey,
  eventDateFromKey,
  hmacAnalyticsValue,
  isAnalyticsBot,
  normalizeAnalyticsAttribution,
  normalizeAnalyticsIdentifier,
  normalizeAnalyticsPath,
  normalizeReferrerHost
} from "@/lib/site-analytics-core";
import { analyticsHashSecret } from "@/lib/site-analytics";

type WhatsAppClickPayload = {
  eventId?: unknown;
  anonymousId?: unknown;
  sessionId?: unknown;
  path?: unknown;
  referrer?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
};

function linkKind(path: string) {
  if (path.startsWith("/produto/")) return "PRODUCT";
  if (path.startsWith("/carrinho")) return "CART";
  if (path.startsWith("/checkout")) return "CHECKOUT";
  if (path.startsWith("/pedido/")) return "ORDER";
  if (path.startsWith("/promocoes")) return "PROMOTION";
  return "GENERAL";
}

function productSlugFromPath(path: string) {
  if (!path.startsWith("/produto/")) return null;
  const raw = path.slice("/produto/".length).split("/")[0];
  try {
    return decodeURIComponent(raw).trim().slice(0, 180) || null;
  } catch {
    return raw.trim().slice(0, 180) || null;
  }
}

export async function recordWhatsAppClick(payload: WhatsAppClickPayload, headers: Headers, now = new Date()) {
  if (headers.get("dnt") === "1" || headers.get("sec-gpc") === "1") {
    return { ok: true, ignored: true } as const;
  }
  if (isAnalyticsBot(headers.get("user-agent") || "")) return { ok: true, ignored: true } as const;

  const eventId = normalizeAnalyticsIdentifier(payload.eventId);
  const anonymousId = normalizeAnalyticsIdentifier(payload.anonymousId);
  const sessionId = normalizeAnalyticsIdentifier(payload.sessionId);
  const path = normalizeAnalyticsPath(payload.path);
  if (!eventId || !anonymousId || !sessionId || !path) return { ok: false, ignored: false } as const;

  const secret = analyticsHashSecret();
  const visitorHash = hmacAnalyticsValue(secret, anonymousId);
  const sessionHash = hmacAnalyticsValue(secret, sessionId);
  const eventDate = eventDateFromKey(brazilDateKey(now));
  const productSlug = productSlugFromPath(path);
  const product = productSlug
    ? await prisma.product.findFirst({ where: { slug: productSlug }, select: { id: true, slug: true } })
    : null;
  const ownHost = headers.get("x-forwarded-host") || headers.get("host");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.whatsAppClickEvent.create({
        data: {
          eventId,
          eventDate,
          visitorHash,
          sessionHash,
          path,
          linkKind: linkKind(path),
          productId: product?.id || null,
          productSlug: product?.slug || productSlug,
          referrerHost: normalizeReferrerHost(payload.referrer, ownHost),
          utmSource: normalizeAnalyticsAttribution(payload.utmSource),
          utmMedium: normalizeAnalyticsAttribution(payload.utmMedium),
          utmCampaign: normalizeAnalyticsAttribution(payload.utmCampaign),
          occurredAt: now
        }
      });
      await tx.whatsAppSessionDay.createMany({
        data: [{ eventDate, visitorHash, sessionHash, firstSeenAt: now }],
        skipDuplicates: true
      });
      await tx.analyticsVisitorDay.upsert({
        where: { eventDate_visitorHash: { eventDate, visitorHash } },
        create: { eventDate, visitorHash, whatsappClicks: 1, firstSeenAt: now, lastSeenAt: now },
        update: { whatsappClicks: { increment: 1 }, lastSeenAt: now }
      });
    });
    return { ok: true, ignored: false } as const;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return { ok: true, ignored: true } as const;
    }
    throw error;
  }
}
