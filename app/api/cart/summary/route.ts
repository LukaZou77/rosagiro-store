import { NextResponse } from "next/server";
import { getCartCompletionRecommendations } from "@/lib/cart-completion";
import { prisma } from "@/lib/db";
import { discountCents, subtotalCents, totalCents } from "@/lib/money";
import { siteConfig } from "@/lib/site-config";

type CartSummaryItem = {
  slug?: unknown;
  quantity?: unknown;
};

function parseItems(input: unknown) {
  if (!Array.isArray(input)) return [];

  return input
    .map((item: CartSummaryItem) => ({
      slug: String(item?.slug || "").trim(),
      quantity: Math.max(0, Math.min(999, Math.floor(Number(item?.quantity) || 0)))
    }))
    .filter((item) => item.slug && item.quantity > 0);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const requestedItems = parseItems(payload?.items);
    const uniqueSlugs = [...new Set(requestedItems.map((item) => item.slug))];
    const products = uniqueSlugs.length
      ? await prisma.product.findMany({
          where: { slug: { in: uniqueSlugs } },
          include: { brand: true, inventory: true }
        })
      : [];
    const recommendationProducts = requestedItems.length
      ? await prisma.product.findMany({
          where: { active: true },
          include: { brand: true, category: true, inventory: true },
          orderBy: { featuredRank: "asc" }
        })
      : [];
    const productMap = new Map(products.map((product) => [product.slug, product]));

    const lines = requestedItems.map((item) => {
      const product = productMap.get(item.slug);
      const stockQuantity = product?.inventory?.quantity ?? 0;
      const active = Boolean(product?.active);
      const available = active && stockQuantity > 0;
      const acceptedQuantity = product ? Math.min(item.quantity, Math.max(stockQuantity, 0)) : 0;
      const lineTotalCents = product ? product.priceCents * acceptedQuantity : 0;
      const warning = !product
        ? "Produto nao encontrado."
        : !active
          ? "Produto indisponivel."
          : stockQuantity <= 0
            ? "Produto sem estoque."
            : item.quantity > stockQuantity
              ? `Ajustado para ${stockQuantity} un. em estoque.`
              : "";

      return {
        slug: item.slug,
        name: product?.name || item.slug,
        brandName: product?.brand.name || "",
        image: product?.image || "",
        priceCents: product?.priceCents || 0,
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
    const discount = discountCents(subtotal);
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
        error: "Nao foi possivel resumir o carrinho agora."
      },
      { status: 500 }
    );
  }
}
