import type { CartSummary } from "@/lib/cart-summary";

export type QuickPurchaseSummaryState =
  | { cartKey: string; requestCycle: number; status: "success"; data: CartSummary }
  | { cartKey: string; requestCycle: number; status: "error"; message: string };

export function shouldFetchQuickPurchaseSummary(options: {
  drawerOpen: boolean;
  cartLength: number;
}) {
  return options.drawerOpen && options.cartLength > 0;
}

export function isCurrentQuickPurchaseRequest(options: {
  requestId: number;
  activeRequestId: number;
  aborted: boolean;
}) {
  return !options.aborted && options.requestId === options.activeRequestId;
}

export function currentQuickPurchaseSummaryState(
  state: QuickPurchaseSummaryState | null,
  cartKey: string,
  requestCycle: number
) {
  if (!state || state.cartKey !== cartKey || state.requestCycle !== requestCycle) return null;
  return state;
}

export function wrappedDialogFocusTarget<T>(options: {
  elements: T[];
  activeElement: T | null;
  activeInside: boolean;
  shiftKey: boolean;
}) {
  const first = options.elements[0];
  const last = options.elements[options.elements.length - 1];
  if (!first || !last) return null;
  if (!options.activeInside) return options.shiftKey ? last : first;
  if (options.shiftKey && options.activeElement === first) return last;
  if (!options.shiftKey && options.activeElement === last) return first;
  return null;
}
