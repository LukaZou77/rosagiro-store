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

export type PriceAdjustmentJobSnapshot = {
  id: string;
  status: string;
  totalProducts: number;
  processedProducts: number;
  adjustedProducts: number;
  adjustedSkus: number;
  skippedProducts: number;
  skippedSkus: number;
  descriptionWarnings: number;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

const priceAdjustmentJobSelect = {
  id: true,
  status: true,
  totalProducts: true,
  processedProducts: true,
  adjustedProducts: true,
  adjustedSkus: true,
  skippedProducts: true,
  skippedSkus: true,
  descriptionWarnings: true,
  error: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true
} satisfies Prisma.PriceAdjustmentJobSelect;

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

function jobSnapshot(
  job: Prisma.PriceAdjustmentJobGetPayload<{
    select: typeof priceAdjustmentJobSelect;
  }>
): PriceAdjustmentJobSnapshot {
  return job;
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
    wholesalePackage: product.wholesalePackage,
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
    descriptionWarningCount: 0,
    productUpdate: {
      priceCents: pricing.priceCents,
      basePriceCents,
      baseBoxPriceCents: pricing.baseBoxPriceCents,
      baseBoxPieces: pricing.baseBoxPieces,
      descriptionPt: pricing.descriptionPt,
      wholesalePackage: pricing.wholesalePackage
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

export async function createPriceAdjustmentJob(config: PriceAdjustmentConfig, adminEmail?: string | null) {
  const totalProducts = await prisma.product.count({
    where: { deletedAt: null }
  });

  const job = await prisma.$transaction(async (tx) => {
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

    return tx.priceAdjustmentJob.create({
      data: {
        direction: config.direction,
        type: config.type,
        value: config.value,
        totalProducts,
        createdByAdminEmail: adminEmail || null
      },
      select: priceAdjustmentJobSelect
    });
  });

  return jobSnapshot(job);
}

export async function getPriceAdjustmentJob(jobId: string) {
  const job = await prisma.priceAdjustmentJob.findUnique({
    where: { id: jobId },
    select: priceAdjustmentJobSelect
  });
  return job ? jobSnapshot(job) : null;
}

function configFromJob(job: { direction: string; type: string; value: number }): PriceAdjustmentConfig {
  return priceAdjustmentConfigFromStoredValues(job.direction, job.type, job.value);
}

export async function processPriceAdjustmentJobChunk(jobId: string, batchSize = 50) {
  const job = await prisma.priceAdjustmentJob.findUnique({
    where: { id: jobId }
  });

  if (!job) return null;
  if (job.status === "COMPLETED" || job.status === "FAILED") {
    return getPriceAdjustmentJob(jobId);
  }

  const config = configFromJob(job);
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: productAdjustmentInclude,
    orderBy: { id: "asc" },
    skip: job.processedProducts,
    take: batchSize
  });

  if (!products.length) {
    const completed = await prisma.priceAdjustmentJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        processedProducts: job.totalProducts,
        finishedAt: new Date()
      },
      select: priceAdjustmentJobSelect
    });
    return jobSnapshot(completed);
  }

  const examples: PriceAdjustmentSummary["examples"] = [];
  const chunkSummary = {
    processedProducts: products.length,
    adjustedProducts: 0,
    adjustedSkus: 0,
    skippedProducts: 0,
    skippedSkus: 0,
    descriptionWarnings: 0
  };

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        const runningJob = await tx.priceAdjustmentJob.update({
          where: { id: jobId },
          data: {
            status: "RUNNING",
            startedAt: job.startedAt ?? new Date()
          }
        });

        if (runningJob.status === "COMPLETED" || runningJob.status === "FAILED") {
          return tx.priceAdjustmentJob.findUniqueOrThrow({
            where: { id: jobId },
            select: priceAdjustmentJobSelect
          });
        }

        for (const product of products) {
          const result = summarizeProductAdjustment(product, config, examples);
          if (!result.ok) {
            chunkSummary.skippedProducts += result.skippedProductCount;
            continue;
          }

          chunkSummary.adjustedProducts += 1;
          chunkSummary.adjustedSkus += result.skuUpdates.length;
          chunkSummary.skippedSkus += result.skippedSkuCount;
          chunkSummary.descriptionWarnings += result.descriptionWarningCount;

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

        const nextProcessed = Math.min(job.totalProducts, job.processedProducts + chunkSummary.processedProducts);
        const completed = nextProcessed >= job.totalProducts;

        return tx.priceAdjustmentJob.update({
          where: { id: jobId },
          data: {
            status: completed ? "COMPLETED" : "RUNNING",
            processedProducts: nextProcessed,
            adjustedProducts: { increment: chunkSummary.adjustedProducts },
            adjustedSkus: { increment: chunkSummary.adjustedSkus },
            skippedProducts: { increment: chunkSummary.skippedProducts },
            skippedSkus: { increment: chunkSummary.skippedSkus },
            descriptionWarnings: { increment: chunkSummary.descriptionWarnings },
            finishedAt: completed ? new Date() : null
          },
          select: priceAdjustmentJobSelect
        });
      },
      { maxWait: 10_000, timeout: 60_000 }
    );

    return jobSnapshot(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível aplicar o ajuste de preços.";
    const failed = await prisma.priceAdjustmentJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: message,
        finishedAt: new Date()
      },
      select: priceAdjustmentJobSelect
    });
    return jobSnapshot(failed);
  }
}
