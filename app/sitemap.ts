import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { allInfoPages, siteUrl } from "@/lib/site-config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = ["", "/categoria/all", ...allInfoPages.map((page) => page.href)].map(
    (path) => ({
      url: siteUrl(path),
      lastModified: new Date()
    })
  );

  try {
    const [categories, products] = await Promise.all([
      prisma.category.findMany({ select: { slug: true, updatedAt: true } }),
      prisma.product.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } })
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
      }))
    ];
  } catch {
    return staticRoutes;
  }
}
