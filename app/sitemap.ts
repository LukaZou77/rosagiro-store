import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { getPublishedGuideArticles } from "@/lib/guide-articles";
import { MIN_INDEXABLE_BRAND_PRODUCTS } from "@/lib/seo";
import { getAllSiteInfoPages } from "@/lib/site-info-pages";
import { siteUrl } from "@/lib/site-config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [infoPages, guides] = await Promise.all([getAllSiteInfoPages(), getPublishedGuideArticles()]);
  const staticPaths = new Set([
    "",
    "/categoria/all",
    "/marcas",
    "/promocoes",
    "/informacoes-da-loja",
    ...(guides.length ? ["/guias"] : []),
    ...infoPages.filter((page) => page.active).map((page) => page.href)
  ]);
  const staticRoutes = Array.from(staticPaths, (path) => ({ url: siteUrl(path) }));

  try {
    const [brands, categories, products] = await Promise.all([
      prisma.brand.findMany({
        where: { products: { some: { active: true, deletedAt: null } } },
        select: {
          slug: true,
          updatedAt: true,
          _count: { select: { products: { where: { active: true, deletedAt: null } } } }
        }
      }),
      prisma.category.findMany({ select: { slug: true, updatedAt: true } }),
      prisma.product.findMany({ where: { active: true, deletedAt: null }, select: { slug: true, updatedAt: true } })
    ]);

    return [
      ...staticRoutes,
      ...brands
        .filter((brand) => brand._count.products >= MIN_INDEXABLE_BRAND_PRODUCTS)
        .map((brand) => ({
          url: siteUrl(`/marcas/${brand.slug}`),
          lastModified: brand.updatedAt
        })),
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
