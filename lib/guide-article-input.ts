import { slugify } from "@/lib/product-import-shared";

export const GUIDE_BODY_MAX_LENGTH = 12000;
export const GUIDE_EXCERPT_MAX_LENGTH = 280;
export const GUIDE_COVER_ALT_MAX_LENGTH = 180;
export const GUIDE_EDITOR_NAME_MAX_LENGTH = 120;
export const GUIDE_SOURCE_NOTES_MAX_LENGTH = 2400;

export type GuideArticleInput = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  coverImageAlt: string;
  body: string;
  authorName: string;
  reviewerName: string;
  reviewedAt: Date | null;
  sourceNotes: string;
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

function cleanReviewDate(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new GuideArticleValidationError("Informe uma data de revisao valida.");
  }
  const date = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
    throw new GuideArticleValidationError("Informe uma data de revisao valida.");
  }
  return date;
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
  coverImageAlt: unknown;
  body: unknown;
  authorName: unknown;
  reviewerName: unknown;
  reviewedAt: unknown;
  sourceNotes: unknown;
  active: boolean;
  sortOrder: number;
}): GuideArticleInput {
  const title = cleanText(input.title).slice(0, 160);
  const slug = normalizeSlug(cleanText(input.slug), title);
  const excerpt = cleanText(input.excerpt).slice(0, GUIDE_EXCERPT_MAX_LENGTH);
  const body = cleanText(input.body).slice(0, GUIDE_BODY_MAX_LENGTH);
  const coverImage = cleanText(input.coverImage);
  const coverImageAlt = cleanText(input.coverImageAlt).slice(0, GUIDE_COVER_ALT_MAX_LENGTH);
  const authorName = cleanText(input.authorName).slice(0, GUIDE_EDITOR_NAME_MAX_LENGTH);
  const reviewerName = cleanText(input.reviewerName).slice(0, GUIDE_EDITOR_NAME_MAX_LENGTH);
  const reviewedAt = cleanReviewDate(input.reviewedAt);
  const sourceNotes = cleanText(input.sourceNotes).slice(0, GUIDE_SOURCE_NOTES_MAX_LENGTH);

  if (!title) throw new GuideArticleValidationError("Informe o titulo do guia.");
  if (!slug) throw new GuideArticleValidationError("Informe um slug valido para o guia.");
  if (!excerpt) throw new GuideArticleValidationError("Informe um resumo curto para o guia.");
  if (!body) throw new GuideArticleValidationError("Escreva o conteudo do guia.");
  if ([title, excerpt, body, coverImageAlt, authorName, reviewerName, sourceNotes].some(hasHtml)) {
    throw new GuideArticleValidationError("Use apenas texto simples nos guias. Nao cole HTML.");
  }
  if (coverImage && !isAllowedGuideImage(coverImage)) {
    throw new GuideArticleValidationError("A imagem de capa deve usar /uploads/guides/..., /assets/... ou URL http(s).");
  }
  if (coverImage && !coverImageAlt) {
    throw new GuideArticleValidationError("Descreva a imagem de capa para acessibilidade.");
  }
  if (input.active && (!authorName || !reviewerName || !reviewedAt || !sourceNotes)) {
    throw new GuideArticleValidationError("Para publicar, informe autor, revisao humana, data da revisao e fontes ou criterio de verificacao.");
  }

  return {
    id: cleanText(input.id) || undefined,
    title,
    slug,
    excerpt,
    coverImage,
    coverImageAlt,
    body,
    authorName,
    reviewerName,
    reviewedAt,
    sourceNotes,
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
