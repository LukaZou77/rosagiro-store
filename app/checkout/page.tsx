import { CheckoutClient } from "@/components/CheckoutClient";
import { StoreShell } from "@/components/StoreShell";
import { getCategories, getProducts } from "@/lib/catalog";
import { getStoreProfile, storeTrustSignals } from "@/lib/store-profile";

export default async function CheckoutPage() {
  const [categories, products, storeProfile] = await Promise.all([getCategories(), getProducts(), getStoreProfile()]);
  return (
    <StoreShell categories={categories}>
      <CheckoutClient products={products} trustSignals={storeTrustSignals(storeProfile)} />
    </StoreShell>
  );
}
