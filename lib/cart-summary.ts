import type { CartCompletionRecommendation } from "@/lib/cart-completion";

export type CartSummaryLine = {
  slug: string;
  name: string;
  brandName: string;
  image: string;
  priceCents: number;
  requestedQuantity: number;
  quantity: number;
  stockQuantity: number;
  packagePieces: number | null;
  packagePriceCents: number | null;
  packageValid: boolean;
  packageCount: number;
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
  packageReady: boolean;
  recommendations: CartCompletionRecommendation[];
  error?: string;
};
