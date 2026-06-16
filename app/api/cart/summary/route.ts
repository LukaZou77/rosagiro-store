import { NextResponse } from "next/server";
import { getCartCompletionRecommendations } from "@/lib/cart-completion";
import { prisma } from "@/lib/db";
import { discountCents, subtotalCents, totalCents } from "@/lib/money";
import { effectiveSkuPriceCents } from "@/lib/product-pricing";
import { siteConfig } from "@/lib/site-config";

type CartSummaryItem = {
  slug?: unknown;
  skuId?: unknown;
  quantity?: unknown;
};

function parseItems(input: unknown) {
  if (!Array.isArray(input)) return [];

  const byKey = new Map<string, { slug: string; skuId?: string; quantity: number }>();
  for (const item of input as CartSummaryItem[]) {
    const slug = String(item?.slug || "").trim();
    const skuId = String(item?.skuId || "").trim() || undefined;
    const quantity = Math.max(0, Math.min(999, Math.floor(Number(item?.quantity) || 0)));
    if (!slug || quantity <= 0) continue;
    const key = `${slug}::${skuId || ""}`;
    const existing = byKey.get(key);
    if (existing) existing.quantity += quantity;
    else byKey.set(key, { slug, skuId, quantity });
  }

  return Array.from(byKey.values());
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const requestedItems = parseItems(payload?.items);
    const uniqueSlugs = [...new Set(requestedItems.map((item) => item.slug))];
    const products = uniqueSlugs.length
      ? await prisma.product.findMany({
          where: { slug: { in: uniqueSlugs }, deletedAt: null },
          include: { brand: true, inventory: true, skus: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } }
        })
      : [];
    const recommendationProducts = requestedItems.length
      ? await prisma.product.findMany({
          where: { active: true, deletedAt: null },
          include: { brand: true, category: true, inventory: true, skus: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
          orderBy: { featuredRank: "asc" }
        })
      : [];
    const productMap = new Map(products.map((product) => [product.slug, product]));

    const lines = requestedItems.map((item) => {
      const product = productMap.get(item.slug);
      const activeSkus = product?.skus.filter((sku) => sku.active) || [];
      const selectedSku = item.skuId ? activeSkus.find((sku) => sku.id === item.skuId) : null;
      const requiresSku = activeSkus.length > 0;
      const stockQuantity = requiresSku ? selectedSku?.quantity ?? 0 : product?.inventory?.quantity ?? 0;
      const active = Boolean(product?.active);
      const available = active && (!requiresSku || Boolean(selectedSku)) && stockQuantity > 0;
      const acceptedQuantity = product ? Math.min(item.quantity, Math.max(stockQuantity, 0)) : 0;
      const priceCents = product ? effectiveSkuPriceCents(product, selectedSku) : 0;
      const lineTotalCents = priceCents * acceptedQuantity;
      const warning = !product
        ? "Produto não encontrado."
        : !active
          ? "Produto indisponível."
          : requiresSku && !selectedSku
            ? "Escolha uma variação disponível."
            : stockQuantity <= 0
              ? "Produto sem estoque."
              : item.quantity > stockQuantity
                ? "Quantidade ajustada ao estoque disponível."
                : "";

      return {
        slug: item.slug,
        skuId: selectedSku?.id || item.skuId || null,
        skuName: selectedSku?.name || null,
        skuCode: selectedSku?.code || null,
        name: product?.name || item.slug,
        brandName: product?.brand.name || "",
        image: product?.image || "",
        priceCents,
        requestedQuantity: item.quantity,
        quantity: acceptedQuantity,
        stockQuantity,
        active,
        available,
        warning,
        lineTotalCents
      };
    });
    const validLines = lines.filter((line) => line.quantity > 0 && line.available);
    const subtotal = subtotalCents(validLines.map((line) => ({ priceCents: line.priceCents, quantity: line.quantity })));
    const discount = discountCents();
    const total = totalCents(subtotal, discount, 0);
    const minimumOrderCents = siteConfig.wholesale.minimumOrderCents;
    const remainingToMinimumCents = Math.max(0, minimumOrderCents - subtotal);
    const recommendations = getCartCompletionRecommendations(recommendationProducts, requestedItems, {
      limit: 4,
      minimumOrderCents
    });

    return NextResponse.json({
      lines,
      subtotalCents: subtotal,
      discountCents: discount,
      totalCents: total,
      minimumOrderCents,
      remainingToMinimumCents,
      minimumReached: remainingToMinimumCents === 0,
      recommendations
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        lines: [],
        subtotalCents: 0,
        discountCents: 0,
        totalCents: 0,
        minimumOrderCents: siteConfig.wholesale.minimumOrderCents,
        remainingToMinimumCents: siteConfig.wholesale.minimumOrderCents,
        minimumReached: false,
        recommendations: [],
        error: "Não foi possível resumir o carrinho agora."
      },
      { status: 500 }
    );
  }
}
