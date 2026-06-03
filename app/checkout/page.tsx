import type { Metadata } from "next";
import { CheckoutClient } from "@/components/CheckoutClient";
import { StoreShell } from "@/components/StoreShell";
import { getCategories, getProducts } from "@/lib/catalog";
import { noIndexMetadata } from "@/lib/seo";
import { getStoreProfile, storeTrustSignals } from "@/lib/store-profile";

export const metadata: Metadata = noIndexMetadata("Checkout", "Checkout de compra Bela Viva.");

export default async function CheckoutPage() {
  const [categories, products, storeProfile] = await Promise.all([getCategories(), getProducts(), getStoreProfile()]);
  return (
    <StoreShell categories={categories}>
      <CheckoutClient products={products} trustSignals={storeTrustSignals(storeProfile)} />
    </StoreShell>
  );
}
