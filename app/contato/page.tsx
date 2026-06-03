import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { storefrontMetadata } from "@/lib/seo";
import { getSiteInfoPage } from "@/lib/site-info-pages";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getSiteInfoPage("contact");
  return storefrontMetadata({
    title: page.title,
    description: page.description,
    path: page.href
  });
}

export default async function ContactPage() {
  const page = await getSiteInfoPage("contact");
  return <InfoPage page={page} />;
}
