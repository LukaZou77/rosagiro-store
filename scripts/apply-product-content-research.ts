import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

type Confidence = "high" | "medium";
type ShippingWeightStatus = "verified_gross" | "not_found";

type ResearchEntry = {
  slug: string;
  name?: string | null;
  brand: string;
  brandCorrection?: string;
  model: string;
  confidence: Confidence;
  descriptionPt: string;
  volume: string | null;
  shippingWeightGrams: number | null;
  shippingWeightStatus: ShippingWeightStatus;
  shippingWeightNote: string;
  sources: Array<{
    label: string;
    url: string;
    evidence: string;
  }>;
};

type ResearchBatch = {
  batch: string;
  createdAt: string;
  entries: ResearchEntry[];
};

const envLocal = ".env.local";
if (existsSync(envLocal)) {
  for (const line of readFileSync(envLocal, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

function argument(name: string, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const mode = argument("--mode", "dry-run");
if (mode !== "dry-run" && mode !== "apply") throw new Error("--mode must be dry-run or apply.");
const summaryOnly = process.argv.includes("--summary-only");

const batchPath = resolve(argument("--batch", "scripts/data/product-content-batch-001.json"));
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

function validateBatch(batch: ResearchBatch) {
  if (!batch.batch || !Array.isArray(batch.entries) || !batch.entries.length) {
    throw new Error("The research batch is empty or invalid.");
  }

  const seen = new Set<string>();
  const descriptions = new Set<string>();
  for (const entry of batch.entries) {
    if (!entry.slug || seen.has(entry.slug)) throw new Error(`Duplicate or empty slug: ${entry.slug}`);
    seen.add(entry.slug);
    if (!entry.brand.trim() || !entry.model.trim()) throw new Error(`${entry.slug}: brand and model are required.`);
    if (entry.brandCorrection !== undefined && entry.brandCorrection.trim().length < 2) {
      throw new Error(`${entry.slug}: brandCorrection must contain a valid brand name.`);
    }
    if (entry.name !== undefined && entry.name !== null && entry.name.trim().length < 10) {
      throw new Error(`${entry.slug}: corrected name must contain at least 10 characters.`);
    }
    if (entry.confidence !== "high" && entry.confidence !== "medium") {
      throw new Error(`${entry.slug}: confidence must be high or medium.`);
    }
    if (entry.descriptionPt.trim().length < 140) {
      throw new Error(`${entry.slug}: descriptionPt must contain at least 140 characters.`);
    }
    if (/preço\s+unitário|embalagem\s+para\s+atacado/i.test(entry.descriptionPt)) {
      throw new Error(`${entry.slug}: commercial terms must stay outside descriptionPt.`);
    }
    if (/descubra|imperd[ií]vel|perfeito para|resultados garantidos/i.test(entry.descriptionPt)) {
      throw new Error(`${entry.slug}: descriptionPt contains prohibited generic marketing language.`);
    }
    if (descriptions.has(entry.descriptionPt.trim())) {
      throw new Error(`${entry.slug}: descriptionPt duplicates another entry in the batch.`);
    }
    descriptions.add(entry.descriptionPt.trim());
    if (!Array.isArray(entry.sources) || !entry.sources.length) {
      throw new Error(`${entry.slug}: at least one source is required.`);
    }
    for (const source of entry.sources) {
      if (!source.label.trim() || !source.evidence.trim() || !/^https:\/\//i.test(source.url)) {
        throw new Error(`${entry.slug}: each source requires a label, HTTPS URL and evidence note.`);
      }
    }
    if (!entry.sources.length || entry.sources.some((source) => !source.url.startsWith("https://"))) {
      throw new Error(`${entry.slug}: at least one HTTPS evidence source is required.`);
    }
    if (entry.shippingWeightGrams !== null) {
      if (entry.shippingWeightStatus !== "verified_gross" || entry.shippingWeightGrams < 1) {
        throw new Error(`${entry.slug}: shipping weight requires verified_gross evidence.`);
      }
    } else if (entry.shippingWeightStatus !== "not_found") {
      throw new Error(`${entry.slug}: missing shipping weight must use not_found status.`);
    }
  }
}

async function main() {
  const batch = JSON.parse(readFileSync(batchPath, "utf8")) as ResearchBatch;
  validateBatch(batch);

  const products = await prisma.product.findMany({
    where: { slug: { in: batch.entries.map((entry) => entry.slug) }, deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      descriptionPt: true,
      volume: true,
      weightGrams: true,
      brand: { select: { name: true } }
    }
  });
  const productBySlug = new Map(products.map((product) => [product.slug, product]));
  const missing = batch.entries.filter((entry) => !productBySlug.has(entry.slug)).map((entry) => entry.slug);
  if (missing.length) throw new Error(`Products not found: ${missing.join(", ")}`);

  const previews = batch.entries.map((entry) => {
    const product = productBySlug.get(entry.slug)!;
    const brandMatches = product.brand.name.localeCompare(entry.brand, "pt-BR", { sensitivity: "base" }) === 0;
    if (!brandMatches) throw new Error(`${entry.slug}: batch brand does not match the catalog brand.`);

    return {
      slug: entry.slug,
      oldName: product.name,
      newName: entry.name?.trim() || product.name,
      oldBrand: product.brand.name,
      newBrand: entry.brandCorrection?.trim() || product.brand.name,
      confidence: entry.confidence,
      sources: entry.sources.length,
      oldDescriptionPt: product.descriptionPt,
      newDescriptionPt: entry.descriptionPt.trim(),
      oldVolume: product.volume,
      newVolume: entry.volume?.trim() || product.volume,
      oldWeightGrams: product.weightGrams,
      newWeightGrams: entry.shippingWeightGrams ?? product.weightGrams,
      shippingWeightStatus: entry.shippingWeightStatus,
      shippingWeightNote: entry.shippingWeightNote
    };
  });
  const pendingPreviews = previews.filter(
    (preview) =>
      preview.oldName !== preview.newName ||
      preview.oldBrand !== preview.newBrand ||
      preview.oldDescriptionPt !== preview.newDescriptionPt ||
      preview.oldVolume !== preview.newVolume ||
      preview.oldWeightGrams !== preview.newWeightGrams
  );
  const pendingSlugs = new Set(pendingPreviews.map((preview) => preview.slug));
  const pendingEntries = batch.entries.filter((entry) => pendingSlugs.has(entry.slug));

  let appliedVerified = 0;
  if (mode === "apply" && pendingEntries.length) {
    await prisma.$transaction(
      async (transaction) => {
        for (const entry of pendingEntries) {
          await transaction.product.update({
            where: { slug: entry.slug },
            data: {
              ...(entry.name?.trim() ? { name: entry.name.trim() } : {}),
              ...(entry.brandCorrection?.trim()
                ? { brand: { connect: { name: entry.brandCorrection.trim() } } }
                : {}),
              descriptionPt: entry.descriptionPt.trim(),
              ...(entry.volume?.trim() ? { volume: entry.volume.trim() } : {}),
              ...(entry.shippingWeightGrams !== null ? { weightGrams: entry.shippingWeightGrams } : {})
            }
          });
        }
      },
      { maxWait: 10_000, timeout: 180_000 }
    );

    const appliedProducts = await prisma.product.findMany({
      where: { slug: { in: pendingEntries.map((entry) => entry.slug) }, deletedAt: null },
      select: {
        slug: true,
        name: true,
        descriptionPt: true,
        volume: true,
        weightGrams: true,
        brand: { select: { name: true } }
      }
    });
    const appliedBySlug = new Map(appliedProducts.map((product) => [product.slug, product]));
    const failedVerification = pendingEntries.filter((entry) => {
      const before = productBySlug.get(entry.slug)!;
      const after = appliedBySlug.get(entry.slug);
      return (
        !after ||
        after.name !== (entry.name?.trim() || before.name) ||
        after.brand.name !== (entry.brandCorrection?.trim() || before.brand.name) ||
        after.descriptionPt !== entry.descriptionPt.trim() ||
        after.volume !== (entry.volume?.trim() || before.volume) ||
        after.weightGrams !== (entry.shippingWeightGrams ?? before.weightGrams)
      );
    });
    if (failedVerification.length) {
      throw new Error(`Product content read-back failed: ${failedVerification.map((entry) => entry.slug).join(", ")}`);
    }
    appliedVerified = appliedProducts.length;
  }

  console.log(
    JSON.stringify(
      {
        mode,
        batch: batch.batch,
        scanned: batch.entries.length,
        ready: pendingEntries.length,
        appliedVerified,
        missing: missing.length,
        verifiedShippingWeights: pendingEntries.filter((entry) => entry.shippingWeightGrams !== null).length,
        specificationUpdates: pendingEntries.filter((entry) => entry.volume?.trim()).length,
        ...(summaryOnly ? {} : { previews: pendingPreviews })
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
