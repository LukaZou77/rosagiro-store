import type { CartCompletionRecommendation } from "@/lib/cart-completion";

export type CartSummaryLine = {
  slug: string;
  skuId: string | null;
  skuName: string | null;
  skuCode: string | null;
  name: string;
  brandName: string;
  image: string;
  priceCents: number;
  requestedQuantity: number;
  quantity: number;
  stockQuantity: number;
  active: boolean;
  available: boolean;
  warning: string;
  lineTotalCents: number;
};

export type CartSummary = {
  lines: CartSummaryLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  minimumOrderCents: number;
  remainingToMinimumCents: number;
  minimumReached: boolean;
  recommendations: CartCompletionRecommendation[];
  error?: string;
};
