import { sitemapIndexXml, xmlResponse } from "@/lib/sitemaps";

export const revalidate = 3600;

export function GET() {
  return xmlResponse(sitemapIndexXml([
    "/sitemaps/static.xml",
    "/sitemaps/categories.xml",
    "/sitemaps/brands.xml",
    "/sitemaps/products.xml",
    "/sitemaps/content.xml"
  ]));
}
