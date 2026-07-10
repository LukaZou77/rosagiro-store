import { brandSitemapEntries, sitemapXml, xmlResponse } from "@/lib/sitemaps";

export const revalidate = 3600;

export async function GET() {
  return xmlResponse(sitemapXml(await brandSitemapEntries()));
}
