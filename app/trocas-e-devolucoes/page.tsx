import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { getSiteInfoPage } from "@/lib/site-info-pages";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getSiteInfoPage("returns");
  return {
    title: page.title,
    description: page.description
  };
}

export default async function ReturnsPage() {
  const page = await getSiteInfoPage("returns");
  return <InfoPage page={page} />;
}
