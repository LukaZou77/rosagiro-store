import { CartClient } from "@/components/CartClient";
import { StoreShell } from "@/components/StoreShell";
import { getCategories, getProducts } from "@/lib/catalog";

export default async function CartPage() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  return (
    <StoreShell categories={categories}>
      <CartClient products={products} />
    </StoreShell>
  );
}
