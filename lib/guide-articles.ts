import "server-only";

import { prisma } from "@/lib/db";
import type { GuideArticle } from "@/src/generated/prisma/client";

export {
  GUIDE_BODY_MAX_LENGTH,
  GUIDE_COVER_ALT_MAX_LENGTH,
  GUIDE_EDITOR_NAME_MAX_LENGTH,
  GUIDE_EXCERPT_MAX_LENGTH,
  GUIDE_SOURCE_NOTES_MAX_LENGTH,
  GuideArticleValidationError,
  isAllowedGuideImage,
  validateGuideArticleInput
} from "@/lib/guide-article-input";
export type { GuideArticleInput } from "@/lib/guide-article-input";

export function guideBodyParagraphs(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export async function getPublishedGuideArticles(options: { take?: number } = {}) {
  try {
    return await prisma.guideArticle.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }, { updatedAt: "desc" }],
      take: options.take,
      select: {
        slug: true,
        title: true,
        excerpt: true,
        coverImage: true,
        coverImageAlt: true,
        authorName: true,
        reviewerName: true,
        reviewedAt: true,
        sourceNotes: true,
        publishedAt: true,
        updatedAt: true
      }
    });
  } catch {
    return [];
  }
}

export async function getGuideArticleBySlug(slug: string) {
  try {
    return await prisma.guideArticle.findFirst({
      where: { slug, active: true }
    });
  } catch {
    return null;
  }
}

export async function getAdminGuideArticles(): Promise<GuideArticle[]> {
  try {
    return await prisma.guideArticle.findMany({
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }]
    });
  } catch {
    return [];
  }
}
