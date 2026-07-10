import { existsSync, readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseStandardWholesaleDescription } from "../lib/product-price-adjustment";
import { wholesalePackageFromLegacyDescription } from "../lib/product-wholesale";

const envLocal = ".env.local";
if (existsSync(envLocal)) {
  for (const line of readFileSync(envLocal, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      slug: true,
      priceCents: true,
      descriptionPt: true,
      wholesalePackage: true,
      baseBoxPriceCents: true,
      baseBoxPieces: true
    },
    orderBy: { slug: "asc" }
  });

  const updates: Array<{ id: string; slug: string; wholesalePackage: string }> = [];
  const skipped: Array<{ slug: string; reason: string }> = [];

  for (const product of products) {
    const parsed = parseStandardWholesaleDescription(product.descriptionPt);
    const wholesalePackage = wholesalePackageFromLegacyDescription(product.descriptionPt);
    if (!parsed.matched || !wholesalePackage) {
      skipped.push({ slug: product.slug, reason: "description is not the legacy commercial format" });
      continue;
    }
    if (parsed.unitPriceCents !== product.priceCents) {
      skipped.push({ slug: product.slug, reason: "description price does not match priceCents" });
      continue;
    }
    if (parsed.boxPriceCents && (!product.baseBoxPriceCents || !product.baseBoxPieces)) {
      skipped.push({ slug: product.slug, reason: "box values are missing from base fields" });
      continue;
    }
    if (product.wholesalePackage === wholesalePackage) continue;
    updates.push({ id: product.id, slug: product.slug, wholesalePackage });
  }

  let appliedVerified = 0;
  if (apply && updates.length) {
    await prisma.$transaction(
      async (transaction) => {
        for (const update of updates) {
          await transaction.product.update({
          where: { id: update.id },
          data: { wholesalePackage: update.wholesalePackage }
          });
        }
      },
      { maxWait: 10_000, timeout: 120_000 }
    );

    const appliedProducts = await prisma.product.findMany({
      where: { id: { in: updates.map((update) => update.id) } },
      select: { id: true, wholesalePackage: true }
    });
    const appliedById = new Map(appliedProducts.map((product) => [product.id, product.wholesalePackage]));
    const failedVerification = updates.filter(
      (update) => appliedById.get(update.id) !== update.wholesalePackage
    );
    if (failedVerification.length) {
      throw new Error(`Commercial detail read-back failed for ${failedVerification.length} products.`);
    }
    appliedVerified = appliedProducts.length;
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        scanned: products.length,
        ready: updates.length,
        appliedVerified,
        skipped: skipped.length,
        samples: updates.slice(0, 10),
        skippedSamples: skipped.slice(0, 10)
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
