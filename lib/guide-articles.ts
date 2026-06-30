import "server-only";

import { prisma } from "@/lib/db";
import { slugify } from "@/lib/product-import-shared";
import type { GuideArticle } from "@/src/generated/prisma/client";

export const GUIDE_BODY_MAX_LENGTH = 12000;
export const GUIDE_EXCERPT_MAX_LENGTH = 280;

export type GuideArticleInput = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  body: string;
  active: boolean;
  sortOrder: number;
};

export class GuideArticleValidationError extends Error {}

function hasHtml(value: string) {
  return /<\s*[a-z][\s\S]*>/i.test(value);
}

function cleanText(value: unknown) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function normalizeSlug(value: string, title: string) {
  return slugify(value || title).slice(0, 90);
}

export function validateGuideArticleInput(input: {
  id?: unknown;
  title: unknown;
  slug: unknown;
  excerpt: unknown;
  coverImage: unknown;
  body: unknown;
  active: boolean;
  sortOrder: number;
}): GuideArticleInput {
  const title = cleanText(input.title).slice(0, 160);
  const slug = normalizeSlug(cleanText(input.slug), title);
  const excerpt = cleanText(input.excerpt).slice(0, GUIDE_EXCERPT_MAX_LENGTH);
  const body = cleanText(input.body).slice(0, GUIDE_BODY_MAX_LENGTH);
  const coverImage = cleanText(input.coverImage);

  if (!title) throw new GuideArticleValidationError("Informe o titulo do guia.");
  if (!slug) throw new GuideArticleValidationError("Informe um slug valido para o guia.");
  if (!excerpt) throw new GuideArticleValidationError("Informe um resumo curto para o guia.");
  if (!body) throw new GuideArticleValidationError("Escreva o conteudo do guia.");
  if ([title, excerpt, body].some(hasHtml)) {
    throw new GuideArticleValidationError("Use apenas texto simples nos guias. Nao cole HTML.");
  }
  if (coverImage && !isAllowedGuideImage(coverImage)) {
    throw new GuideArticleValidationError("A imagem de capa deve usar /uploads/guides/..., /assets/... ou URL http(s).");
  }

  return {
    id: cleanText(input.id) || undefined,
    title,
    slug,
    excerpt,
    coverImage,
    body,
    active: input.active,
    sortOrder: Math.max(0, Math.floor(input.sortOrder || 0))
  };
}

export function isAllowedGuideImage(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("/uploads/guides/") || trimmed.startsWith("/assets/") || trimmed.startsWith("/placeholder")) {
    return true;
  }
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

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
