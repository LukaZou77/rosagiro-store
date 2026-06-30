import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { getPublishedGuideArticles } from "@/lib/guide-articles";
import { getAllSiteInfoPages } from "@/lib/site-info-pages";
import { siteUrl } from "@/lib/site-config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [infoPages, guides] = await Promise.all([getAllSiteInfoPages(), getPublishedGuideArticles()]);
  const staticRoutes = ["", "/categoria/all", "/promocoes", "/guias", ...infoPages.map((page) => page.href)].map(
    (path) => ({
      url: siteUrl(path),
      lastModified: new Date()
    })
  );

  try {
    const [categories, products] = await Promise.all([
      prisma.category.findMany({ select: { slug: true, updatedAt: true } }),
      prisma.product.findMany({ where: { active: true, deletedAt: null }, select: { slug: true, updatedAt: true } })
    ]);

    return [
      ...staticRoutes,
      ...categories.map((category) => ({
        url: siteUrl(`/categoria/${category.slug}`),
        lastModified: category.updatedAt
      })),
      ...products.map((product) => ({
        url: siteUrl(`/produto/${product.slug}`),
        lastModified: product.updatedAt
      })),
      ...guides.map((guide) => ({
        url: siteUrl(`/guias/${guide.slug}`),
        lastModified: guide.updatedAt
      }))
    ];
  } catch {
    return staticRoutes;
  }
}
