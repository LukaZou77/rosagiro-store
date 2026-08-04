import type { Metadata } from "next";
import { CartClient } from "@/components/CartClient";
import { StoreShell } from "@/components/StoreShell";
import { getCategories } from "@/lib/catalog";
import { noIndexMetadata } from "@/lib/seo";
import { getStoreProfile, storeTrustSignals } from "@/lib/store-profile";

export const metadata: Metadata = noIndexMetadata("Pedido de atacado", "Monte seu pedido de atacado RosaGiro por embalagem fechada.");

export default async function CartPage() {
  const [categories, storeProfile] = await Promise.all([getCategories(), getStoreProfile()]);
  return (
    <StoreShell categories={categories}>
      <CartClient trustSignals={storeTrustSignals(storeProfile)} />
    </StoreShell>
  );
}
