import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { procurementGuideArticles } from "@/lib/procurement-guide-content";
import { validateGuideArticleInput, type GuideArticleInput } from "@/lib/guide-article-input";
import { Prisma, PrismaClient } from "@/src/generated/prisma/client";

const argumentsFromCli = process.argv.slice(2);
const apply = argumentsFromCli.length === 1 && argumentsFromCli[0] === "--apply";

export const expectedDraftHashes = {
  // These hashes preserve the authorized drafts' empty reviewerName as "".
  // Converting that value to null changes the hash and must not be treated as equivalent.
  "como-montar-pedido-misto-atacado": "914db86a44067f07e2890acf6daee0b931c17d55a38cb218145c1643b7357f1f",
  "entenda-caixa-fechada-caixa-master-e-minimo-por-item": "dec65ed4c1ced351db76dcd7aabc708f7fb97a5ce9b36a84d9ab63fab9a89f7c",
  "como-funciona-frete-e-retirada-no-atacado": "1ab7049f3dba83824b6d9ecac475a4e587256faf3eddcb75e87f35323300ec7b"
} as const;

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

type StoredGuide = GuideHashInput & {
  id: string;
  publishedAt: Date | null;
  updatedAt: Date;
};

export function contentHash(guide: GuideHashInput) {
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

export function assessPublicationState(
  rows: readonly StoredGuide[],
  targets: readonly GuideArticleInput[],
  draftHashes: Readonly<Record<string, string>> = expectedDraftHashes
) {
  const expectedSlugs = targets.map((guide) => guide.slug).sort();
  const actualSlugs = rows.map((guide) => guide.slug).sort();
  if (rows.length !== targets.length || JSON.stringify(actualSlugs) !== JSON.stringify(expectedSlugs)) {
    throw new Error(
      `Esperados exatamente ${targets.length} rascunhos existentes (${expectedSlugs.join(", ")}); encontrados ${rows.length} (${actualSlugs.join(", ") || "nenhum"}). Nenhuma alteracao foi feita.`
    );
  }

  const targetBySlug = new Map(targets.map((guide) => [guide.slug, guide]));
  const states = rows.map((row) => {
    const target = targetBySlug.get(row.slug);
    if (!target) throw new Error(`Guia inesperado no conjunto de publicacao: ${row.slug}`);

    const currentHash = contentHash(row);
    const targetHash = contentHash(target);
    if (currentHash === draftHashes[row.slug] && !row.active && row.publishedAt === null) {
      return { slug: row.slug, state: "expected-draft" as const, currentHash, targetHash };
    }
    if (currentHash === targetHash && row.active && row.publishedAt !== null) {
      return { slug: row.slug, state: "already-published" as const, currentHash, targetHash };
    }
    throw new Error(
      `Conteudo ou estado divergente para ${row.slug}. Esperado rascunho ${draftHashes[row.slug] || "sem hash configurado"} ou publicacao ${targetHash}; encontrado ${currentHash}, active=${row.active}, publishedAt=${row.publishedAt?.toISOString() ?? "null"}. Nenhuma alteracao foi feita.`
    );
  });

  const draftCount = states.filter((guide) => guide.state === "expected-draft").length;
  const publishedCount = states.filter((guide) => guide.state === "already-published").length;
  if (draftCount && publishedCount) {
    throw new Error("Estado parcial detectado entre os tres guias. Nenhuma alteracao foi feita; revise os hashes antes de continuar.");
  }

  return {
    state: draftCount === targets.length ? ("ready-to-publish" as const) : ("already-published" as const),
    guides: states
  };
}

const guides = procurementGuideArticles.map((guide) => validateGuideArticleInput(guide));
const guideSlugs = guides.map((guide) => guide.slug);

if (new Set(guideSlugs).size !== guideSlugs.length || guideSlugs.length !== 3) {
  throw new Error("A publicacao revisada exige exatamente tres slugs unicos.");
}

if (guides.some((guide) => !guide.active || !guide.authorName || !guide.reviewerName || !guide.reviewedAt || !guide.sourceNotes)) {
  throw new Error("Os tres guias precisam estar ativos e conter autor, revisao editorial identificada, data e fontes.");
}

const guideSelect = {
  id: true,
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
  sortOrder: true,
  updatedAt: true
} satisfies Prisma.GuideArticleSelect;

async function readBack(client: PrismaClient | Prisma.TransactionClient) {
  return client.guideArticle.findMany({
    where: { slug: { in: guideSlugs } },
    orderBy: { slug: "asc" },
    select: guideSelect
  });
}

function reportFor(rows: readonly StoredGuide[], state: "ready-to-publish" | "already-published" | "published") {
  const bySlug = new Map(rows.map((guide) => [guide.slug, guide]));
  return guides.map((guide) => {
    const row = bySlug.get(guide.slug);
    return {
      slug: guide.slug,
      status: state,
      expectedDraftHash: expectedDraftHashes[guide.slug as keyof typeof expectedDraftHashes],
      targetHash: contentHash(guide),
      readBackHash: row ? contentHash(row) : null,
      active: row?.active ?? null,
      publishedAt: row?.publishedAt?.toISOString() ?? null
    };
  });
}

function publicationData(guide: GuideArticleInput, publishedAt: Date) {
  return {
    title: guide.title,
    slug: guide.slug,
    excerpt: guide.excerpt,
    coverImage: guide.coverImage,
    coverImageAlt: guide.coverImageAlt,
    body: guide.body,
    authorName: guide.authorName,
    reviewerName: guide.reviewerName,
    reviewedAt: guide.reviewedAt,
    sourceNotes: guide.sourceNotes,
    active: guide.active,
    sortOrder: guide.sortOrder,
    publishedAt
  };
}

async function main() {
  if (argumentsFromCli.length > 1 || (argumentsFromCli.length === 1 && !apply)) {
    throw new Error("Uso: tsx scripts/publish-procurement-guides.ts [--apply]");
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to inspect or publish procurement guides.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const initialRows = await readBack(prisma);
    const initialAssessment = assessPublicationState(initialRows, guides);
    let changedCount = 0;
    let outcome: "ready-to-publish" | "already-published" | "published" = initialAssessment.state;

    if (apply && initialAssessment.state === "ready-to-publish") {
      const transactionOutcome = await prisma.$transaction(
        async (tx) => {
          const lockedRows = await readBack(tx);
          const lockedAssessment = assessPublicationState(lockedRows, guides);
          if (lockedAssessment.state === "already-published") return "already-published" as const;

          const rowBySlug = new Map(lockedRows.map((guide) => [guide.slug, guide]));
          const publishedAt = new Date();
          for (const guide of guides) {
            const current = rowBySlug.get(guide.slug);
            if (!current) throw new Error(`Rascunho ausente durante a transacao: ${guide.slug}`);
            const result = await tx.guideArticle.updateMany({
              where: { id: current.id, updatedAt: current.updatedAt },
              data: publicationData(guide, publishedAt)
            });
            if (result.count !== 1) {
              throw new Error(`Edicao concorrente detectada em ${guide.slug}. A transacao foi cancelada.`);
            }
          }
          return "published" as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      outcome = transactionOutcome;
      changedCount = transactionOutcome === "published" ? guides.length : 0;
    }

    const finalRows = apply ? await readBack(prisma) : initialRows;
    const finalAssessment = assessPublicationState(finalRows, guides);
    if (apply && finalAssessment.state !== "already-published") {
      throw new Error("A leitura final nao confirmou os tres guias publicados.");
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          initialState: initialAssessment.state,
          outcome,
          expectedCount: guides.length,
          readBackCount: finalRows.length,
          changedCount,
          guides: reportFor(finalRows, apply ? outcome : initialAssessment.state)
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

const entryPoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (entryPoint === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
