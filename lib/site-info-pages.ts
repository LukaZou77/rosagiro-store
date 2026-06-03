import "server-only";

import { prisma } from "@/lib/db";
import { type InfoPageContent, infoPages } from "@/lib/site-config";
import type { Prisma } from "@/src/generated/prisma/client";

export const siteInfoPageKeys = ["privacy", "terms", "returns", "shipping", "contact"] as const;
export type SiteInfoPageKey = (typeof siteInfoPageKeys)[number];

export const SITE_INFO_PAGE_SECTION_LIMIT = 6;

export type SiteInfoPageSection = {
  title: string;
  body: string;
};

export type SiteInfoPageEditable = InfoPageContent & {
  pageKey: SiteInfoPageKey;
  active: boolean;
  updatedAt?: Date | null;
};

export class SiteInfoPageValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

const defaultPageByKey = infoPages satisfies Record<SiteInfoPageKey, InfoPageContent>;
const htmlTagPattern = /<[^>]*>/;

function cleanText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hasHtmlTag(value: string) {
  return htmlTagPattern.test(value);
}

function assertPlainText(label: string, value: string) {
  if (hasHtmlTag(value)) {
    throw new SiteInfoPageValidationError(`${label} deve ser texto simples, sem HTML.`);
  }
}

export function siteInfoPageDefault(pageKey: SiteInfoPageKey): SiteInfoPageEditable {
  const page = defaultPageByKey[pageKey];
  return {
    pageKey,
    active: true,
    ...page,
    sections: page.sections.map((section) => ({ ...section }))
  };
}

export function isSiteInfoPageKey(value: string): value is SiteInfoPageKey {
  return (siteInfoPageKeys as readonly string[]).includes(value);
}

export function normalizeSiteInfoSections(input: unknown): SiteInfoPageSection[] {
  const rawSections = Array.isArray(input) ? input : [];
  return rawSections
    .map((section) => {
      const entry = section as Partial<SiteInfoPageSection>;
      return {
        title: cleanText(entry.title),
        body: cleanText(entry.body)
      };
    })
    .filter((section) => section.title || section.body);
}

export function validateSiteInfoPageInput(input: {
  pageKey: string;
  eyebrow: unknown;
  title: unknown;
  description: unknown;
  sections: unknown;
}) {
  if (!isSiteInfoPageKey(input.pageKey)) {
    throw new SiteInfoPageValidationError("Pagina de politica invalida.");
  }

  const defaults = siteInfoPageDefault(input.pageKey);
  const eyebrow = cleanText(input.eyebrow);
  const title = cleanText(input.title);
  const description = cleanText(input.description);
  const sections = normalizeSiteInfoSections(input.sections);

  if (!eyebrow || !title || !description) {
    throw new SiteInfoPageValidationError("Preencha chamada, titulo e descricao.");
  }
  if (!sections.length) {
    throw new SiteInfoPageValidationError("Cadastre pelo menos uma secao com titulo e texto.");
  }
  if (sections.length > SITE_INFO_PAGE_SECTION_LIMIT) {
    throw new SiteInfoPageValidationError(`Cada pagina aceita no maximo ${SITE_INFO_PAGE_SECTION_LIMIT} secoes.`);
  }
  for (const [index, section] of sections.entries()) {
    if (!section.title || !section.body) {
      throw new SiteInfoPageValidationError(`Complete titulo e texto da secao ${index + 1}.`);
    }
  }

  assertPlainText("Chamada", eyebrow);
  assertPlainText("Titulo", title);
  assertPlainText("Descricao", description);
  for (const [index, section] of sections.entries()) {
    assertPlainText(`Titulo da secao ${index + 1}`, section.title);
    assertPlainText(`Texto da secao ${index + 1}`, section.body);
  }

  return {
    pageKey: input.pageKey,
    slug: defaults.slug,
    href: defaults.href,
    eyebrow,
    title,
    description,
    sections
  };
}

function pageFromRecord(
  pageKey: SiteInfoPageKey,
  record: {
    slug: string;
    href: string;
    eyebrow: string;
    title: string;
    description: string;
    sections: Prisma.JsonValue;
    active: boolean;
    updatedAt: Date;
  } | null
): SiteInfoPageEditable {
  if (!record) return siteInfoPageDefault(pageKey);

  const sections = normalizeSiteInfoSections(record.sections).slice(0, SITE_INFO_PAGE_SECTION_LIMIT);
  if (!sections.length) return siteInfoPageDefault(pageKey);

  return {
    pageKey,
    slug: record.slug,
    href: record.href,
    eyebrow: record.eyebrow,
    title: record.title,
    description: record.description,
    sections,
    active: record.active,
    updatedAt: record.updatedAt
  };
}

export async function getSiteInfoPage(pageKey: SiteInfoPageKey): Promise<SiteInfoPageEditable> {
  try {
    const record = await prisma.siteInfoPage.findUnique({
      where: { pageKey },
      select: {
        slug: true,
        href: true,
        eyebrow: true,
        title: true,
        description: true,
        sections: true,
        active: true,
        updatedAt: true
      }
    });
    if (!record?.active) return siteInfoPageDefault(pageKey);
    return pageFromRecord(pageKey, record);
  } catch {
    return siteInfoPageDefault(pageKey);
  }
}

export async function getAllSiteInfoPages(): Promise<SiteInfoPageEditable[]> {
  try {
    const records = await prisma.siteInfoPage.findMany({
      where: { pageKey: { in: [...siteInfoPageKeys] } },
      select: {
        pageKey: true,
        slug: true,
        href: true,
        eyebrow: true,
        title: true,
        description: true,
        sections: true,
        active: true,
        updatedAt: true
      },
      orderBy: { pageKey: "asc" }
    });
    const byKey = new Map(records.map((record) => [record.pageKey, record]));
    return siteInfoPageKeys.map((pageKey) => pageFromRecord(pageKey, byKey.get(pageKey) || null));
  } catch {
    return siteInfoPageKeys.map(siteInfoPageDefault);
  }
}

export function siteInfoPageLabel(pageKey: SiteInfoPageKey) {
  const labels: Record<SiteInfoPageKey, string> = {
    privacy: "Privacidade",
    terms: "Termos de uso",
    returns: "Trocas e devolucoes",
    shipping: "Entrega",
    contact: "Contato"
  };
  return labels[pageKey];
}
