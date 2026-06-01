import "server-only";

import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { validateCheckoutAddress } from "@/lib/google-address";
import { discountCents, subtotalCents, totalCents } from "@/lib/money";
import { isPaymentMethod, type PaymentMethodValue } from "@/lib/payments";
import { resolveOrderShipping } from "@/lib/shipping";

export type CartInput = {
  slug: string;
  quantity: number;
};

type CheckoutShippingMethod = "PADRAO" | "EXPRESSA" | "ANJUN_D2D_PICKUP" | "RETIRADA_LOCAL";

export type CheckoutInput = {
  items: CartInput[];
  customer: {
    name: string;
    email: string;
    phone: string;
    cpf: string;
  };
  address: {
    cep: string;
    state: string;
    city: string;
    district: string;
    street: string;
    number: string;
    complement?: string;
  };
  shippingMethod: CheckoutShippingMethod;
  paymentMethod: PaymentMethodValue;
};

export class OrderError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

export function parseCheckoutPayload(payload: unknown): CheckoutInput {
  const data = payload as Partial<CheckoutInput>;
  const items = Array.isArray(data.items)
    ? data.items
        .map((item) => ({
          slug: cleanText(item.slug),
          quantity: Math.max(1, Math.min(20, Number(item.quantity) || 0))
        }))
        .filter((item) => item.slug && item.quantity > 0)
    : [];

  const customer = {
    name: cleanText(data.customer?.name),
    email: cleanText(data.customer?.email).toLowerCase(),
    phone: cleanText(data.customer?.phone),
    cpf: cleanText(data.customer?.cpf)
  };

  const address = {
    cep: cleanText(data.address?.cep),
    state: cleanText(data.address?.state).toUpperCase(),
    city: cleanText(data.address?.city),
    district: cleanText(data.address?.district),
    street: cleanText(data.address?.street),
    number: cleanText(data.address?.number),
    complement: cleanText(data.address?.complement)
  };

  const rawShippingMethod = cleanText(data.shippingMethod).toUpperCase();
  const shippingMethod: CheckoutShippingMethod =
    rawShippingMethod === "ANJUN_D2D_PICKUP" ||
    rawShippingMethod === "RETIRADA_LOCAL" ||
    rawShippingMethod === "EXPRESSA" ||
    rawShippingMethod === "PADRAO"
      ? rawShippingMethod
      : "RETIRADA_LOCAL";
  const rawPaymentMethod = cleanText((data as Partial<CheckoutInput>).paymentMethod).toUpperCase();
  const paymentMethod = isPaymentMethod(rawPaymentMethod) ? rawPaymentMethod : "SIMULATED";

  if (!items.length) throw new OrderError("Seu carrinho esta vazio.");
  if (!customer.name || !customer.email || !customer.phone || !customer.cpf) {
    throw new OrderError("Preencha todos os dados de contato.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    throw new OrderError("Informe um e-mail valido.");
  }
  if (digits(customer.cpf).length !== 11) throw new OrderError("CPF deve ter 11 digitos.");
  if (digits(customer.phone).length < 10) throw new OrderError("Telefone deve ter DDD e numero.");
  if (digits(address.cep).length !== 8) throw new OrderError("CEP deve ter 8 digitos.");
  if (!address.state || !address.city || !address.district || !address.street || !address.number) {
    throw new OrderError("Preencha todos os dados de endereco.");
  }

  return { items, customer, address, shippingMethod, paymentMethod };
}

function makeOrderNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = randomInt(1000, 9999);
  return `BV-${stamp}-${suffix}`;
}

export async function createOrder(input: CheckoutInput) {
  const slugs = input.items.map((item) => item.slug);
  const products = await prisma.product.findMany({
    where: { slug: { in: slugs }, active: true },
    include: { brand: true, inventory: true }
  });
  const productBySlug = new Map(products.map((product) => [product.slug, product]));

  const lines = input.items.map((item) => {
    const product = productBySlug.get(item.slug);
    if (!product) throw new OrderError("Um produto do carrinho nao esta mais disponivel.");
    if ((product.inventory?.quantity || 0) < item.quantity) {
      throw new OrderError(`${product.name} nao tem estoque suficiente.`);
    }
    return {
      product,
      quantity: item.quantity,
      priceCents: product.priceCents,
      weightGrams: product.weightGrams
    };
  });

  const subtotal = subtotalCents(lines);
  const discount = discountCents(subtotal);
  let shippingQuote;
  try {
    shippingQuote = await resolveOrderShipping({
      method: input.shippingMethod,
      cep: input.address.cep,
      subtotal,
      lines
    });
  } catch (error) {
    throw new OrderError(
      error instanceof Error
        ? error.message
        : "Nao foi possivel recalcular o frete. Revise o CEP ou escolha retirada local."
    );
  }
  const total = totalCents(subtotal, discount, shippingQuote.shippingCents);
  const addressMatch = await validateCheckoutAddress(input.address);

  const order = await prisma.order.create({
    data: {
      orderNumber: makeOrderNumber(),
      customerName: input.customer.name,
      customerEmail: input.customer.email,
      customerPhone: input.customer.phone,
      customerCpf: input.customer.cpf,
      cep: input.address.cep,
      state: input.address.state,
      city: input.address.city,
      district: input.address.district,
      street: input.address.street,
      number: input.address.number,
      complement: input.address.complement || null,
      addressMatchStatus: addressMatch.status,
      addressMatchProvider: addressMatch.provider,
      addressMatchFormatted: addressMatch.formattedAddress,
      addressMatchPlaceId: addressMatch.placeId,
      addressMatchGranularity: addressMatch.granularity,
      addressLatitude: addressMatch.latitude,
      addressLongitude: addressMatch.longitude,
      addressMatchMessage: addressMatch.message,
      addressMatchCheckedAt: addressMatch.checkedAt,
      shippingMethod: shippingQuote.method,
      shippingCarrier: shippingQuote.carrier,
      shippingService: shippingQuote.service,
      shippingServiceLabel: shippingQuote.serviceLabel,
      shippingRateId: shippingQuote.rateId,
      shippingZone: shippingQuote.zone,
      shippingCity: shippingQuote.city,
      shippingWeightGrams: shippingQuote.weightGrams,
      shippingEstimate: shippingQuote.estimate,
      shippingQuoteStatus: shippingQuote.status,
      shippingQuoteMessage: shippingQuote.message,
      shippingQuoteSnapshot: shippingQuote.snapshot,
      subtotalCents: subtotal,
      discountCents: discount,
      shippingCents: shippingQuote.shippingCents,
      totalCents: total,
      items: {
        create: lines.map((line) => ({
          productId: line.product.id,
          productSlug: line.product.slug,
          productName: line.product.name,
          productBrand: line.product.brand.name,
          productImage: line.product.image,
          unitPriceCents: line.priceCents,
          quantity: line.quantity,
          lineTotalCents: line.priceCents * line.quantity
        }))
      },
      payment: {
        create: {
          method: input.paymentMethod,
          amountCents: total
        }
      }
    },
    select: { orderNumber: true }
  });

  return order;
}

export async function simulatePayment(orderNumber: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNumber },
      include: { items: true, payment: true }
    });
    if (!order) throw new OrderError("Pedido nao encontrado.", 404);
    if (order.status === "PAID") return order;
    if (order.status !== "PENDING_PAYMENT") throw new OrderError("Este pedido nao pode ser pago.");

    for (const item of order.items) {
      if (!item.productId) throw new OrderError(`${item.productName} nao esta mais disponivel.`);
      const updated = await tx.inventory.updateMany({
        where: {
          productId: item.productId,
          quantity: { gte: item.quantity }
        },
        data: {
          quantity: { decrement: item.quantity }
        }
      });
      if (updated.count !== 1) throw new OrderError(`${item.productName} nao tem estoque suficiente.`);
    }

    await tx.payment.update({
      where: { orderId: order.id },
      data: { status: "PAID", paidAt: new Date() }
    });

    return tx.order.update({
      where: { id: order.id },
      data: { status: "PAID" },
      include: { items: true, payment: true }
    });
  });
}
