import { CartClient } from "@/components/CartClient";
import { StoreShell } from "@/components/StoreShell";
import { getCategories, getProducts } from "@/lib/catalog";
import { getStoreProfile, storeTrustSignals } from "@/lib/store-profile";

export default async function CartPage() {
  const [categories, products, storeProfile] = await Promise.all([getCategories(), getProducts(), getStoreProfile()]);
  return (
    <StoreShell categories={categories}>
      <CartClient products={products} trustSignals={storeTrustSignals(storeProfile)} />
    </StoreShell>
  );
}
