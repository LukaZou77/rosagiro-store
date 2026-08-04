import { NextResponse } from "next/server";
import { getCartCompletionRecommendations } from "@/lib/cart-completion";
import type { CartSummary } from "@/lib/cart-summary";
import { prisma } from "@/lib/db";
import { discountCents, totalCents } from "@/lib/money";
import {
  productWholesaleLineTotalCents,
  productWholesalePackagePieces,
  productWholesalePackagePriceCents,
  productWholesaleStockQuantity
} from "@/lib/product-wholesale";
import { siteConfig } from "@/lib/site-config";
import { normalizeWholesaleLineQuantity } from "@/lib/wholesale-order";

type CartSummaryItem = {
  slug?: unknown;
  quantity?: unknown;
};

function parseItems(input: unknown) {
  if (!Array.isArray(input)) return [];

  const bySlug = new Map<string, { slug: string; quantity: number }>();
  for (const item of input as CartSummaryItem[]) {
    const slug = String(item?.slug || "").trim();
    const quantity = normalizeWholesaleLineQuantity(item?.quantity);
    if (!slug || quantity <= 0) continue;
    const existing = bySlug.get(slug);
    if (existing) existing.quantity = normalizeWholesaleLineQuantity(existing.quantity + quantity);
    else bySlug.set(slug, { slug, quantity });
  }

  return Array.from(bySlug.values());
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const requestedItems = parseItems(payload?.items);
    const uniqueSlugs = [...new Set(requestedItems.map((item) => item.slug))];
    const products = uniqueSlugs.length
      ? await prisma.product.findMany({
          where: { slug: { in: uniqueSlugs }, deletedAt: null },
          include: { brand: true, category: true, inventory: true, skus: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } }
        })
      : [];
    const recommendationProducts = requestedItems.length
      ? await prisma.product.findMany({
          where: {
            active: true,
            deletedAt: null,
            OR: [{ inventory: { quantity: { gt: 0 } } }, { skus: { some: { active: true, quantity: { gt: 0 } } } }]
          },
          include: { brand: true, category: true, inventory: true, skus: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
          orderBy: { featuredRank: "asc" },
          take: 64
        })
      : [];
    const productMap = new Map(products.map((product) => [product.slug, product]));
    const requestedQuantityBySlug = new Map<string, number>();
    for (const item of requestedItems) {
      requestedQuantityBySlug.set(item.slug, (requestedQuantityBySlug.get(item.slug) || 0) + item.quantity);
    }

    const lines = requestedItems.map((item) => {
      const product = productMap.get(item.slug);
      const stockQuantity = product ? productWholesaleStockQuantity(product) : 0;
      const packagePieces = product ? productWholesalePackagePieces(product) : null;
      const packagePriceCents = product ? productWholesalePackagePriceCents(product) : null;
      const requestedProductQuantity = requestedQuantityBySlug.get(item.slug) || item.quantity;
      const packageValid = Boolean(packagePieces && requestedProductQuantity % packagePieces === 0);
      const packageCount = packagePieces ? Math.floor(requestedProductQuantity / packagePieces) : 0;
      const active = Boolean(product?.active);
      const available = active && stockQuantity >= item.quantity && Boolean(packagePieces);
      const acceptedQuantity = product ? item.quantity : 0;
      const priceCents = product?.priceCents || 0;
      const lineTotalCents = product ? productWholesaleLineTotalCents(product, acceptedQuantity) : 0;
      const warning = !product
        ? "Produto não encontrado."
        : !active
          ? "Produto indisponível."
          : !packagePieces
            ? "Embalagem fechada sob consulta. Fale com o atendimento."
            : stockQuantity <= 0
              ? "Produto sem estoque."
              : item.quantity > stockQuantity
                ? "Não há embalagens completas suficientes para esta quantidade."
                : !packageValid
                  ? `Este produto é vendido somente em embalagem fechada com ${packagePieces} unidades.`
                : "";

      return {
        slug: item.slug,
        name: product?.name || item.slug,
        brandName: product?.brand.name || "",
        image: product?.image || "",
        priceCents,
        requestedQuantity: item.quantity,
        quantity: acceptedQuantity,
        stockQuantity,
        packagePieces,
        packagePriceCents,
        packageValid,
        packageCount,
        active,
        available,
        warning,
        lineTotalCents
      };
    });
    const validLines = lines.filter((line) => line.quantity > 0 && line.available && line.packageValid);
    const packageReady = lines.length > 0 && lines.every((line) => line.available && line.packageValid);
    const subtotal = validLines.reduce((sum, line) => sum + line.lineTotalCents, 0);
    const discount = discountCents();
    const total = totalCents(subtotal, discount, 0);
    const minimumOrderCents = siteConfig.wholesale.minimumOrderCents;
    const remainingToMinimumCents = Math.max(0, minimumOrderCents - subtotal);
    const preferredCategorySlugs = products.map((product) => product.category.slug).filter(Boolean);
    const recommendations = getCartCompletionRecommendations(recommendationProducts, requestedItems, {
      limit: 4,
      minimumOrderCents,
      cartSubtotalCents: subtotal,
      preferredCategorySlugs
    });

    const response: CartSummary = {
      lines,
      subtotalCents: subtotal,
      discountCents: discount,
      totalCents: total,
      minimumOrderCents,
      remainingToMinimumCents,
      minimumReached: remainingToMinimumCents === 0,
      packageReady,
      recommendations
    };

    return NextResponse.json(response);
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
        packageReady: false,
        recommendations: [],
        error: "Não foi possível resumir o carrinho agora."
      },
      { status: 500 }
    );
  }
}
