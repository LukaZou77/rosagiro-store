import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { infoPages } from "@/lib/site-config";

const page = infoPages.returns;

export const metadata: Metadata = {
  title: page.title,
  description: page.description
};

export default function ReturnsPage() {
  return <InfoPage page={page} />;
}
