import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { storefrontMetadata } from "@/lib/seo";
import { getSiteInfoPage } from "@/lib/site-info-pages";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getSiteInfoPage("shipping");
  return storefrontMetadata({
    title: page.title,
    description: page.description,
    path: page.href
  });
}

export default async function ShippingPage() {
  const page = await getSiteInfoPage("shipping");
  return <InfoPage page={page} />;
}
