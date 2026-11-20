import { NextResponse } from "next/server";
import { getCartCompletionRecommendations } from "@/lib/cart-completion";
import type { CartSummary } from "@/lib/cart-summary";
import { prisma } from "@/lib/db";
import { discountCents, totalCents } from "@/lib/money";
import {
  productWholesalePackagePieces,
  productWholesalePackagePriceCents,
  productWholesaleStockQuantity
} from "@/lib/product-wholesale";
import { siteConfig } from "@/lib/site-config";
import { isSourceCatalogConsultationProduct } from "@/lib/source-catalog-product";
import {
  MAX_WHOLESALE_ORDER_TOTAL_CENTS,
  normalizeWholesaleLineQuantity,
  wholesaleOrderTotalLimitNotice,
  wholesaleReferenceUnitPriceCents
} from "@/lib/wholesale-order";
import type { Prisma } from "@/src/generated/prisma/client";

type CartSummaryItem = {
  slug?: unknown;
  quantity?: unknown;
};

const cartProductSelect = {
  slug: true,
  name: true,
  priceCents: true,
  baseBoxPriceCents: true,
  baseBoxPieces: true,
  wholesalePackage: true,
  descriptionPt: true,
  image: true,
  stockStatus: true,
  active: true,
  brand: { select: { name: true } },
  category: { select: { slug: true } },
  inventory: { select: { quantity: true } },
  skus: {
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { quantity: true, active: true }
  }
} satisfies Prisma.ProductSelect;

const recommendationProductSelect = {
  ...cartProductSelect,
  badges: true,
  reviewCount: true
} satisfies Prisma.ProductSelect;

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
    const productsPromise = uniqueSlugs.length
      ? prisma.product.findMany({
          where: { slug: { in: uniqueSlugs }, deletedAt: null },
          select: cartProductSelect
        })
      : Promise.resolve([]);
    const recommendationProductsPromise = requestedItems.length
      ? prisma.product.findMany({
          where: {
            active: true,
            deletedAt: null,
            OR: [{ inventory: { quantity: { gt: 0 } } }, { skus: { some: { active: true, quantity: { gt: 0 } } } }]
          },
          select: recommendationProductSelect,
          orderBy: { featuredRank: "asc" },
          take: 64
        })
      : Promise.resolve([]);
    const [products, recommendationProducts] = await Promise.all([productsPromise, recommendationProductsPromise]);
    const productMap = new Map(products.map((product) => [product.slug, product]));
    const lines = requestedItems.map((item) => {
      const product = productMap.get(item.slug);
      const stockQuantity = product ? productWholesaleStockQuantity(product) : 0;
      const packagePieces = product ? productWholesalePackagePieces(product) : null;
      const packagePriceCents = product ? productWholesalePackagePriceCents(product) : null;
      const packageValid = Boolean(packagePieces && item.quantity % packagePieces === 0);
      const packageCount = packagePieces && packageValid ? item.quantity / packagePieces : 0;
      const active = Boolean(product?.active);
      const available = Boolean(active && packagePieces && packagePriceCents &&
        stockQuantity >= packagePieces && stockQuantity >= item.quantity);
      const acceptedQuantity = product ? item.quantity : 0;
      const priceCents = product && !isSourceCatalogConsultationProduct(product) && packagePieces && packagePriceCents
        ? wholesaleReferenceUnitPriceCents(packagePriceCents, packagePieces)
        : product?.priceCents || 0;
      const lineTotalCents = available && packagePriceCents ? packageCount * packagePriceCents : 0;
      const warning = !product
        ? "Produto não encontrado."
        : !active
          ? "Produto indisponível."
          : isSourceCatalogConsultationProduct(product)
            ? "Estoque, embalagem e preço sob consulta com o atendimento."
            : !packagePieces || !packagePriceCents
              ? "Embalagem ou preço sob consulta. Fale com o atendimento."
              : stockQuantity < packagePieces
                ? "Sem embalagens completas em estoque."
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
    const subtotal = validLines.reduce((sum, line) => sum + line.lineTotalCents, 0);
    const orderLimitNotice = subtotal > MAX_WHOLESALE_ORDER_TOTAL_CENTS ? wholesaleOrderTotalLimitNotice : undefined;
    const packageReady = !orderLimitNotice && lines.length > 0 && validLines.length === lines.length;
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
      orderLimitNotice,
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
