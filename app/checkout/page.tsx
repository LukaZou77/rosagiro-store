import type { Metadata } from "next";
import { CheckoutClient } from "@/components/CheckoutClient";
import { StoreShell } from "@/components/StoreShell";
import { getCategories } from "@/lib/catalog";
import { noIndexMetadata } from "@/lib/seo";
import { configuredMercadoPagoInstallments, getStoreProfile, storeTrustSignals } from "@/lib/store-profile";
import { paymentModeAllowsSimulated } from "@/lib/payments";

export const metadata: Metadata = noIndexMetadata("Checkout", "Checkout de compra RosaGiro.");

export default async function CheckoutPage() {
  const [categories, storeProfile] = await Promise.all([getCategories(), getStoreProfile()]);
  return (
    <StoreShell categories={categories}>
      <CheckoutClient
        trustSignals={storeTrustSignals(storeProfile)}
        mercadoPagoMaxInstallments={configuredMercadoPagoInstallments(storeProfile)}
        includeSimulatedPayment={paymentModeAllowsSimulated(process.env.PAYMENT_MODE)}
      />
    </StoreShell>
  );
}
