import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { infoPages } from "@/lib/site-config";

const page = infoPages.privacy;

export const metadata: Metadata = {
  title: page.title,
  description: page.description
};

export default function PrivacyPage() {
  return <InfoPage page={page} />;
}
