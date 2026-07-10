import "server-only";

import { prisma } from "@/lib/db";
import { getPublishedGuideArticles } from "@/lib/guide-articles";
import { MIN_INDEXABLE_BRAND_PRODUCTS } from "@/lib/seo";
import { getAllSiteInfoPages } from "@/lib/site-info-pages";
import { siteUrl } from "@/lib/site-config";

export type SitemapEntry = {
  url: string;
  lastModified?: Date | string | null;
};

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;"
  })[character] || character);
}

export function sitemapXml(entries: SitemapEntry[]) {
  const body = entries
    .map((entry) => {
      const lastModified = entry.lastModified ? new Date(entry.lastModified).toISOString() : "";
      return `<url><loc>${escapeXml(entry.url)}</loc>${lastModified ? `<lastmod>${lastModified}</lastmod>` : ""}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function sitemapIndexXml(paths: string[]) {
  const now = new Date().toISOString();
  const body = paths.map((path) => `<sitemap><loc>${escapeXml(siteUrl(path))}</loc><lastmod>${now}</lastmod></sitemap>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}

export function xmlResponse(xml: string) {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
    }
  });
}

export async function staticSitemapEntries(): Promise<SitemapEntry[]> {
  const infoPages = await getAllSiteInfoPages();
  const staticPaths = new Set([
    "",
    "/categoria/all",
    "/marcas",
    "/promocoes",
    "/quem-somos",
    "/informacoes-da-loja",
    ...infoPages.filter((page) => page.active).map((page) => page.href)
  ]);
  return Array.from(staticPaths, (path) => ({ url: siteUrl(path) }));
}

export async function categorySitemapEntries(): Promise<SitemapEntry[]> {
  const categories = await prisma.category.findMany({
    where: { products: { some: { active: true, deletedAt: null } } },
    select: { slug: true, updatedAt: true }
  });
  return categories.map((category) => ({ url: siteUrl(`/categoria/${category.slug}`), lastModified: category.updatedAt }));
}

export async function brandSitemapEntries(): Promise<SitemapEntry[]> {
  const brands = await prisma.brand.findMany({
    where: { products: { some: { active: true, deletedAt: null } } },
    select: {
      slug: true,
      updatedAt: true,
      _count: { select: { products: { where: { active: true, deletedAt: null } } } }
    }
  });
  return brands
    .filter((brand) => brand._count.products >= MIN_INDEXABLE_BRAND_PRODUCTS)
    .map((brand) => ({ url: siteUrl(`/marcas/${brand.slug}`), lastModified: brand.updatedAt }));
}

export async function productSitemapEntries(): Promise<SitemapEntry[]> {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      deletedAt: null,
      image: { not: "" },
      descriptionPt: { not: "" },
      priceCents: { gt: 0 }
    },
    select: { slug: true, updatedAt: true },
    orderBy: [{ featuredRank: "desc" }, { updatedAt: "desc" }]
  });
  return products.map((product) => ({ url: siteUrl(`/produto/${product.slug}`), lastModified: product.updatedAt }));
}

export async function contentSitemapEntries(): Promise<SitemapEntry[]> {
  const guides = await getPublishedGuideArticles();
  if (!guides.length) return [];
  return [
    { url: siteUrl("/guias") },
    ...guides.map((guide) => ({ url: siteUrl(`/guias/${guide.slug}`), lastModified: guide.updatedAt }))
  ];
}
