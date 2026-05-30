import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { infoPages } from "@/lib/site-config";

const page = infoPages.shipping;

export const metadata: Metadata = {
  title: page.title,
  description: page.description
};

export default function ShippingPage() {
  return <InfoPage page={page} />;
}
