import "server-only";

import { prisma } from "@/lib/db";
import { STORE_PROFILE_ID } from "@/lib/store-profile";
import {
  adjustPriceCents,
  buildAdjustedProductPricing,
  emptyPriceAdjustment,
  priceAdjustmentConfigFromStoredValues,
  type PriceAdjustmentConfig
} from "@/lib/product-price-adjustment";
import type { Prisma } from "@/src/generated/prisma/client";

const previewExampleLimit = 5;

const productAdjustmentInclude = {
  skus: true
} satisfies Prisma.ProductInclude;

type ProductForAdjustment = Prisma.ProductGetPayload<{
  include: typeof productAdjustmentInclude;
}>;

export type PriceAdjustmentSummary = {
  productCount: number;
  skuCount: number;
  skippedProductCount: number;
  skippedSkuCount: number;
  descriptionWarningCount: number;
  examples: Array<{
    slug: string;
    name: string;
    oldPriceCents: number;
    newPriceCents: number;
    note: string;
  }>;
};

export function configFromStoreProfile(
  profile:
    | {
        priceAdjustmentDirection?: string | null;
        priceAdjustmentType?: string | null;
        priceAdjustmentValue?: number | null;
      }
    | null
    | undefined
) {
  if (!profile) return emptyPriceAdjustment;
  return priceAdjustmentConfigFromStoredValues(
    profile.priceAdjustmentDirection,
    profile.priceAdjustmentType,
    profile.priceAdjustmentValue
  );
}

export async function getSavedPriceAdjustmentConfig(): Promise<PriceAdjustmentConfig> {
  const profile = await prisma.storeProfile.findUnique({
    where: { id: STORE_PROFILE_ID },
    select: {
      priceAdjustmentDirection: true,
      priceAdjustmentType: true,
      priceAdjustmentValue: true
    }
  });

  return configFromStoreProfile(profile);
}

function summarizeProductAdjustment(
  product: ProductForAdjustment,
  config: PriceAdjustmentConfig,
  examples: PriceAdjustmentSummary["examples"]
) {
  const basePriceCents = product.basePriceCents ?? product.priceCents;
  const pricing = buildAdjustedProductPricing({
    basePriceCents,
    descriptionPt: product.descriptionPt,
    config,
    baseBoxPriceCents: product.baseBoxPriceCents,
    baseBoxPieces: product.baseBoxPieces
  });

  if (!pricing.ok) {
    return {
      ok: false as const,
      skippedProductCount: 1,
      skippedSkuCount: 0,
      descriptionWarningCount: 0,
      skuUpdates: []
    };
  }

  let skippedSkuCount = 0;
  const skuUpdates = product.skus.flatMap((sku) => {
    const baseSkuPriceCents = sku.basePriceCents ?? sku.priceCents;
    if (!baseSkuPriceCents) return [];

    const adjustedSkuPriceCents = adjustPriceCents(baseSkuPriceCents, config);
    if (!adjustedSkuPriceCents) {
      skippedSkuCount += 1;
      return [];
    }

    return [
      {
        id: sku.id,
        basePriceCents: baseSkuPriceCents,
        priceCents: adjustedSkuPriceCents
      }
    ];
  });

  if (examples.length < previewExampleLimit && product.priceCents !== pricing.priceCents) {
    examples.push({
      slug: product.slug,
      name: product.name,
      oldPriceCents: product.priceCents,
      newPriceCents: pricing.priceCents,
      note: pricing.descriptionMatched ? "Descrição padrão sincronizada" : "Descrição personalizada não alterada"
    });
  }

  return {
    ok: true as const,
    skippedProductCount: 0,
    skippedSkuCount,
    descriptionWarningCount: pricing.descriptionMatched ? 0 : 1,
    productUpdate: {
      priceCents: pricing.priceCents,
      basePriceCents,
      baseBoxPriceCents: pricing.baseBoxPriceCents,
      baseBoxPieces: pricing.baseBoxPieces,
      descriptionPt: pricing.descriptionPt
    },
    skuUpdates
  };
}

export async function previewPriceAdjustment(config: PriceAdjustmentConfig): Promise<PriceAdjustmentSummary> {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: productAdjustmentInclude,
    orderBy: [{ featuredRank: "asc" }, { updatedAt: "desc" }]
  });

  const examples: PriceAdjustmentSummary["examples"] = [];
  const summary: PriceAdjustmentSummary = {
    productCount: 0,
    skuCount: 0,
    skippedProductCount: 0,
    skippedSkuCount: 0,
    descriptionWarningCount: 0,
    examples
  };

  for (const product of products) {
    const result = summarizeProductAdjustment(product, config, examples);
    if (!result.ok) {
      summary.skippedProductCount += result.skippedProductCount;
      continue;
    }

    summary.productCount += 1;
    summary.skuCount += result.skuUpdates.length;
    summary.skippedSkuCount += result.skippedSkuCount;
    summary.descriptionWarningCount += result.descriptionWarningCount;
  }

  return summary;
}

export async function saveAndApplyPriceAdjustment(config: PriceAdjustmentConfig): Promise<PriceAdjustmentSummary> {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: productAdjustmentInclude,
    orderBy: [{ featuredRank: "asc" }, { updatedAt: "desc" }]
  });

  const examples: PriceAdjustmentSummary["examples"] = [];
  const summary: PriceAdjustmentSummary = {
    productCount: 0,
    skuCount: 0,
    skippedProductCount: 0,
    skippedSkuCount: 0,
    descriptionWarningCount: 0,
    examples
  };

  await prisma.$transaction(
    async (tx) => {
      await tx.storeProfile.upsert({
        where: { id: STORE_PROFILE_ID },
        update: {
          priceAdjustmentDirection: config.direction,
          priceAdjustmentType: config.type,
          priceAdjustmentValue: config.value
        },
        create: {
          id: STORE_PROFILE_ID,
          priceAdjustmentDirection: config.direction,
          priceAdjustmentType: config.type,
          priceAdjustmentValue: config.value
        }
      });

      for (const product of products) {
        const result = summarizeProductAdjustment(product, config, examples);
        if (!result.ok) {
          summary.skippedProductCount += result.skippedProductCount;
          continue;
        }

        summary.productCount += 1;
        summary.skuCount += result.skuUpdates.length;
        summary.skippedSkuCount += result.skippedSkuCount;
        summary.descriptionWarningCount += result.descriptionWarningCount;

        await tx.product.update({
          where: { id: product.id },
          data: result.productUpdate
        });

        for (const sku of result.skuUpdates) {
          await tx.productSku.update({
            where: { id: sku.id },
            data: {
              basePriceCents: sku.basePriceCents,
              priceCents: sku.priceCents
            }
          });
        }
      }
    },
    { maxWait: 10_000, timeout: 120_000 }
  );

  return summary;
}
