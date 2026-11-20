import { createHash } from "node:crypto";

export type CheckoutAttempt = { id: string; requestHash: string };

export class CheckoutAttemptError extends Error {
  constructor(message: string, public status = 409) {
    super(message);
  }
}

export class CheckoutRejectedError extends CheckoutAttemptError {}

const text = (value: unknown) => String(value ?? "").trim();
const digits = (value: unknown) => text(value).replace(/\D/g, "");
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

// Bind the unguessable attempt ID to the original buyer/cart, without storing another
// copy of their contact data. Attribution is deliberately not part of purchase identity.
export function checkoutAttemptFromPayload(payload: unknown): CheckoutAttempt {
  const data = record(payload);
  const id = text(data.checkoutAttemptId).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
    throw new CheckoutAttemptError("Atualize o checkout antes de enviar o pedido. Seu carrinho foi mantido.", 400);
  }
  const customer = record(data.customer);
  const address = record(data.address);
  const items = Array.isArray(data.items) ? data.items.map((value) => {
    const item = record(value);
    return { slug: text(item.slug), quantity: Number(item.quantity) };
  }).sort((a, b) => a.slug.localeCompare(b.slug) || a.quantity - b.quantity) : [];
  const identity = {
    items,
    customer: {
      name: text(customer.name), email: text(customer.email).toLowerCase(),
      phone: digits(customer.phone), cpf: digits(customer.cpf)
    },
    address: {
      cep: digits(address.cep), state: text(address.state).toUpperCase(),
      city: text(address.city), district: text(address.district), street: text(address.street),
      number: text(address.number), complement: text(address.complement)
    },
    paymentMethod: text(data.paymentMethod).toUpperCase(),
    freightSeparateAccepted: data.freightSeparateAccepted === true
  };
  return { id, requestHash: createHash("sha256").update(JSON.stringify(identity)).digest("hex") };
}
