export function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(cents / 100);
}

export function brlInputToCents(value: FormDataEntryValue | null) {
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function subtotalCents(items: Array<{ priceCents: number; quantity: number }>) {
  return items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
}

export function discountCents(subtotal: number) {
  return subtotal >= 25000 ? Math.round(subtotal * 0.1) : 0;
}

export function totalCents(subtotal: number, discount: number, shipping: number) {
  return subtotal - discount + shipping;
}
