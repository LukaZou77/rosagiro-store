import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { getSiteInfoPage } from "@/lib/site-info-pages";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getSiteInfoPage("contact");
  return {
    title: page.title,
    description: page.description
  };
}

export default async function ContactPage() {
  const page = await getSiteInfoPage("contact");
  return <InfoPage page={page} />;
}
