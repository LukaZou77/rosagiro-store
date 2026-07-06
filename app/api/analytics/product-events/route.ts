import { recordProductAnalyticsEvent, type ProductAnalyticsEventType } from "@/lib/product-analytics";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const body = payload as {
    type?: unknown;
    slug?: unknown;
    skuId?: unknown;
    quantity?: unknown;
    anonymousId?: unknown;
  };
  const type =
    body.type === "PRODUCT_VIEW" || body.type === "ADD_TO_CART"
      ? (body.type as ProductAnalyticsEventType)
      : ("INVALID" as ProductAnalyticsEventType);

  try {
    const result = await recordProductAnalyticsEvent({
      type,
      slug: String(body.slug || ""),
      skuId: body.skuId ? String(body.skuId) : null,
      quantity: Number(body.quantity) || 1,
      anonymousId: String(body.anonymousId || "")
    });

    if (!result.ok) return Response.json({ ok: false }, { status: 400 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
