import { CheckoutClient } from "@/components/CheckoutClient";
import { StoreShell } from "@/components/StoreShell";
import { getCategories, getProducts } from "@/lib/catalog";

export default async function CheckoutPage() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  return (
    <StoreShell categories={categories}>
      <CheckoutClient products={products} />
    </StoreShell>
  );
}
