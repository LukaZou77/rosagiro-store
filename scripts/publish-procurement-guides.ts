import { createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/src/generated/prisma/client";
import { procurementGuideArticles } from "@/lib/procurement-guide-content";
import { validateGuideArticleInput } from "@/lib/guide-article-input";

const argumentsFromCli = process.argv.slice(2);
const apply = argumentsFromCli.length === 1 && argumentsFromCli[0] === "--apply";

if (argumentsFromCli.length > 1 || (argumentsFromCli.length === 1 && !apply)) {
  throw new Error("Uso: tsx scripts/publish-procurement-guides.ts [--apply]");
}

const guides = procurementGuideArticles.map((guide) => validateGuideArticleInput(guide));
const guideSlugs = guides.map((guide) => guide.slug);

type GuideHashInput = {
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  coverImageAlt: string | null;
  body: string;
  authorName: string | null;
  reviewerName: string | null;
  reviewedAt: Date | null;
  sourceNotes: string | null;
  active: boolean;
  sortOrder: number;
};

if (new Set(guideSlugs).size !== guideSlugs.length) {
  throw new Error("Os guias de compra precisam ter slugs unicos.");
}

if (guides.some((guide) => guide.active || guide.reviewerName || guide.reviewedAt)) {
  throw new Error("Este script cria somente rascunhos sem revisao humana. Publique pelo admin apos a revisao.");
}

function contentHash(guide: GuideHashInput) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        slug: guide.slug,
        title: guide.title,
        excerpt: guide.excerpt,
        coverImage: guide.coverImage,
        coverImageAlt: guide.coverImageAlt,
        body: guide.body,
        authorName: guide.authorName,
        reviewerName: guide.reviewerName,
        reviewedAt: guide.reviewedAt?.toISOString() ?? null,
        sourceNotes: guide.sourceNotes,
        active: guide.active,
        sortOrder: guide.sortOrder
      })
    )
    .digest("hex");
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to inspect or publish procurement guides.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function readBack() {
  return prisma.guideArticle.findMany({
    where: { slug: { in: guideSlugs } },
    orderBy: { slug: "asc" },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      coverImage: true,
      coverImageAlt: true,
      body: true,
      authorName: true,
      reviewerName: true,
      reviewedAt: true,
      sourceNotes: true,
      active: true,
      publishedAt: true,
      sortOrder: true
    }
  });
}

async function main() {
  const existing = await readBack();
  const existingSlugs = new Set(existing.map((guide) => guide.slug));
  const missing = guides.filter((guide) => !existingSlugs.has(guide.slug));
  const createdSlugs = new Set<string>();

  if (apply && missing.length) {
    await prisma.$transaction(async (tx) => {
      const conflicts = await tx.guideArticle.findMany({
        where: { slug: { in: missing.map((guide) => guide.slug) } },
        select: { slug: true }
      });
      if (conflicts.length) {
        throw new Error(`Guia ja existente; nenhuma alteracao foi feita: ${conflicts.map((guide) => guide.slug).sort().join(", ")}`);
      }

      for (const guide of missing) {
        await tx.guideArticle.create({
          data: {
            ...guide,
            publishedAt: null
          }
        });
        createdSlugs.add(guide.slug);
      }
    });
  }

  const finalRows = apply ? await readBack() : existing;
  const finalBySlug = new Map(finalRows.map((guide) => [guide.slug, guide]));
  const report = guides.map((guide) => {
    const row = finalBySlug.get(guide.slug);
    return {
      slug: guide.slug,
      status: createdSlugs.has(guide.slug) ? "created" : row ? "existing" : "missing",
      contentHash: contentHash(guide),
      readBackHash: row ? contentHash(row) : null,
      active: row?.active ?? null,
      publishedAt: row?.publishedAt?.toISOString() ?? null
    };
  });

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        requestedCount: guides.length,
        existingCount: existing.length,
        missingCount: missing.length,
        createdCount: apply ? missing.length : 0,
        readBackCount: finalRows.length,
        guides: report
      },
      null,
      2
    )
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
