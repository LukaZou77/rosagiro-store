import { formatPlainBrl } from "./product-price-adjustment";

// Reviewed 2026-09-11 against the original TS09002 tray image:
// Box: 1 Un. / R$150,00; Caixa Master: 12 Box / R$1800,00.
// Feishu sheet 0DUtIM, row 2670 has no explicit box price or quantity.
// Source: https://jqphak399n3b6nli.public.blob.vercel-storage.com/products/maleta-completa-toque-special-ts09002/tray-ts09002.jpg
export const TS09002_SLUG = "maleta-completa-toque-special-ts09002";

export function verifiedWholesaleBoxText(slug: string, unitPriceCents: number): string | null {
  if (slug !== TS09002_SLUG) return null;
  if (!Number.isInteger(unitPriceCents) || unitPriceCents <= 0) return null;

  // One complete makeup kit is one saleable box; 12 boxes is the master carton.
  // Keep the current source unit price instead of freezing the historical quote.
  return `${formatPlainBrl(unitPriceCents)}c/1pçs`;
}
