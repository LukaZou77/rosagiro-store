import "server-only";

import { randomInt } from "node:crypto";
import { createOrderNotificationSafely } from "@/lib/admin-notifications";
import { normalizeBrazilWhatsapp, upsertCustomerFromContact } from "@/lib/customers";
import { prisma } from "@/lib/db";
import { validateCheckoutAddress } from "@/lib/google-address";
import { discountCents, subtotalCents, totalCents } from "@/lib/money";
import { isPaymentMethod, paymentModeAllowsSimulated, type PaymentMethodValue } from "@/lib/payments";
import { effectiveSkuPriceCents } from "@/lib/product-pricing";
import { resolveOrderShipping } from "@/lib/shipping";
import { parseCheckoutShippingMethod, type CheckoutShippingMethod } from "@/lib/shipping-rules";
import { getPublicPixPaymentAccount, getStoreProfile } from "@/lib/store-profile";
import type { OrderAttribution } from "@/lib/commerce-analytics";
import type { Prisma } from "@/src/generated/prisma/client";

export type CartInput = {
  slug: string;
  skuId?: string;
  quantity: number;
};

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
  attribution?: OrderAttribution;
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

function cleanAttributionValue(value: unknown) {
  const normalized = cleanText(value).slice(0, 180);
  return /^[a-zA-Z0-9._~%+=:@/-]+$/.test(normalized) ? normalized || null : null;
}

function parseAttribution(value: unknown): OrderAttribution {
  const raw = value as Partial<OrderAttribution> | null;
  return {
    gclid: cleanAttributionValue(raw?.gclid) || undefined,
    gbraid: cleanAttributionValue(raw?.gbraid) || undefined,
    wbraid: cleanAttributionValue(raw?.wbraid) || undefined,
    utmSource: cleanAttributionValue(raw?.utmSource) || undefined,
    utmMedium: cleanAttributionValue(raw?.utmMedium) || undefined,
    utmCampaign: cleanAttributionValue(raw?.utmCampaign) || undefined,
    utmTerm: cleanAttributionValue(raw?.utmTerm) || undefined,
    utmContent: cleanAttributionValue(raw?.utmContent) || undefined
  };
}

export function parseCheckoutPayload(payload: unknown): CheckoutInput {
  const data = payload as Partial<CheckoutInput>;
  const itemsByKey = new Map<string, CartInput>();
  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      const slug = cleanText(item.slug);
      const skuId = cleanText(item.skuId) || undefined;
      const quantity = Math.max(1, Math.min(20, Number(item.quantity) || 0));
      if (!slug || quantity <= 0) continue;
      const key = `${slug}::${skuId || ""}`;
      const existing = itemsByKey.get(key);
      if (existing) existing.quantity = Math.min(20, existing.quantity + quantity);
      else itemsByKey.set(key, { slug, skuId, quantity });
    }
  }
  const items = Array.from(itemsByKey.values());

  const phone = cleanText(data.customer?.phone);
  const normalizedPhone = normalizeBrazilWhatsapp(phone);
  const customer = {
    name: cleanText(data.customer?.name),
    email: cleanText(data.customer?.email).toLowerCase(),
    phone: normalizedPhone?.whatsapp || phone,
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

  const shippingMethod = parseCheckoutShippingMethod(data.shippingMethod);
  if (!shippingMethod) {
    throw new OrderError("Escolha Anjun D2D Pickup ou retirada local.");
  }
  const rawPaymentMethod = cleanText((data as Partial<CheckoutInput>).paymentMethod).toUpperCase();
  if (!isPaymentMethod(rawPaymentMethod)) {
    throw new OrderError("Escolha uma forma de pagamento válida.");
  }
  const paymentMethod = rawPaymentMethod;
  const attribution = parseAttribution(data.attribution);

  if (!items.length) throw new OrderError("Seu carrinho está vazio.");
  if (!customer.name || !customer.email || !customer.phone || !customer.cpf) {
    throw new OrderError("Preencha todos os dados de contato.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    throw new OrderError("Informe um e-mail válido.");
  }
  if (digits(customer.cpf).length !== 11) throw new OrderError("CPF deve ter 11 dígitos.");
  if (!normalizedPhone) throw new OrderError("WhatsApp deve ser do Brasil e ter DDD.");
  if (digits(address.cep).length !== 8) throw new OrderError("CEP deve ter 8 dígitos.");
  if (!address.state || !address.city || !address.district || !address.street || !address.number) {
    throw new OrderError("Preencha todos os dados de endereço.");
  }
  if (paymentMethod === "SIMULATED" && !paymentModeAllowsSimulated(process.env.PAYMENT_MODE)) {
    throw new OrderError("Pagamento temporariamente indisponível. Escolha Pix ou cartão pelo Mercado Pago.", 503);
  }

  return { items, customer, address, shippingMethod, paymentMethod, attribution };
}

function makeOrderNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = randomInt(1000, 9999);
  return `RG-${stamp}-${suffix}`;
}

export async function createOrder(input: CheckoutInput) {
  const slugs = input.items.map((item) => item.slug);
  const products = await prisma.product.findMany({
    where: { slug: { in: slugs }, active: true, deletedAt: null },
    include: { brand: true, inventory: true, skus: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } }
  });
  const productBySlug = new Map(products.map((product) => [product.slug, product]));

  const lines = input.items.map((item) => {
    const product = productBySlug.get(item.slug);
    if (!product) throw new OrderError("Um produto do carrinho não está mais disponível.");
    const activeSkus = product.skus.filter((sku) => sku.active);
    const selectedSku = item.skuId ? activeSkus.find((sku) => sku.id === item.skuId) : null;
    const requiresSku = activeSkus.length > 0;
    if (requiresSku && !selectedSku) {
      throw new OrderError(`Escolha uma variação disponível para ${product.name}.`);
    }
    const availableQuantity = requiresSku ? selectedSku?.quantity ?? 0 : product.inventory?.quantity || 0;
    if (availableQuantity < item.quantity) {
      throw new OrderError(`${product.name} não tem estoque suficiente.`);
    }
    return {
      product,
      sku: selectedSku || null,
      quantity: item.quantity,
      priceCents: effectiveSkuPriceCents(product, selectedSku),
      weightGrams: product.weightGrams
    };
  });

  const subtotal = subtotalCents(lines);
  const discount = discountCents();
  let shippingQuote;
  try {
    shippingQuote = await resolveOrderShipping({
      method: input.shippingMethod,
      cep: input.address.cep,
      lines
    });
  } catch (error) {
    throw new OrderError(
      error instanceof Error
        ? error.message
        : "Não foi possível recalcular o frete. Revise o CEP ou escolha retirada local."
    );
  }
  const total = totalCents(subtotal, discount, shippingQuote.shippingCents);
  const addressMatch = await validateCheckoutAddress(input.address);
  const customer = await upsertCustomerFromContact(input.customer.name, input.customer.phone);
  const pixAccount = input.paymentMethod === "PIX" ? getPublicPixPaymentAccount(await getStoreProfile()) : null;

  const order = await prisma.order.create({
    data: {
      customerId: customer.id,
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
      gclid: input.attribution?.gclid || null,
      gbraid: input.attribution?.gbraid || null,
      wbraid: input.attribution?.wbraid || null,
      utmSource: input.attribution?.utmSource || null,
      utmMedium: input.attribution?.utmMedium || null,
      utmCampaign: input.attribution?.utmCampaign || null,
      utmTerm: input.attribution?.utmTerm || null,
      utmContent: input.attribution?.utmContent || null,
      items: {
        create: lines.map((line) => ({
          productId: line.product.id,
          productSkuId: line.sku?.id || null,
          productSlug: line.product.slug,
          productName: line.product.name,
          productBrand: line.product.brand.name,
          productImage: line.sku?.image || line.product.image,
          productSkuName: line.sku?.name || null,
          productSkuCode: line.sku?.code || null,
          unitPriceCents: line.priceCents,
          quantity: line.quantity,
          lineTotalCents: line.priceCents * line.quantity
        }))
      },
      payment: {
        create: {
          method: input.paymentMethod,
          amountCents: total,
          providerStatus: pixAccount ? "manual_pix_pending" : null,
          providerStatusDetail: pixAccount ? "Aguardando comprovante Pix pelo atendimento." : null,
          providerPayload: pixAccount ? (pixAccount satisfies Prisma.InputJsonValue) : undefined
        }
      }
    },
    select: { id: true, orderNumber: true, customerName: true, totalCents: true }
  });

  await createOrderNotificationSafely("NEW_ORDER", order);

  return order;
}

type PaidOrderPaymentUpdate = {
  provider?: "SIMULATED" | "MERCADO_PAGO";
  providerPaymentId?: string | null;
  providerExternalReference?: string | null;
  providerStatus?: string | null;
  providerStatusDetail?: string | null;
  providerPayload?: Prisma.InputJsonValue;
  lastWebhookAt?: Date;
  paidAt?: Date;
};

export async function markOrderPaid(orderNumber: string, paymentUpdate: PaidOrderPaymentUpdate = {}) {
  const order = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNumber },
      include: { items: true, payment: true }
    });
    if (!order) throw new OrderError("Pedido não encontrado.", 404);
    if (order.status === "PAID") {
      const shouldRefreshProvider =
        paymentUpdate.provider === "MERCADO_PAGO" ||
        Boolean(paymentUpdate.providerPaymentId || paymentUpdate.providerStatus || paymentUpdate.lastWebhookAt);
      if (order.payment && shouldRefreshProvider) {
        await tx.payment.update({
          where: { orderId: order.id },
          data: {
            provider: paymentUpdate.provider,
            providerPaymentId: paymentUpdate.providerPaymentId,
            providerExternalReference: paymentUpdate.providerExternalReference,
            providerStatus: paymentUpdate.providerStatus,
            providerStatusDetail: paymentUpdate.providerStatusDetail,
            providerPayload: paymentUpdate.providerPayload,
            lastWebhookAt: paymentUpdate.lastWebhookAt,
            syncError: null
          }
        });
      }
      return order;
    }
    if (order.status !== "PENDING_PAYMENT") throw new OrderError("Este pedido não pode ser pago.");

    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING_PAYMENT" },
      data: { status: "PAID" }
    });
    if (claimed.count !== 1) {
      const currentOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: { items: true, payment: true }
      });
      if (currentOrder?.status === "PAID") return currentOrder;
      throw new OrderError("Este pedido não pode ser pago.");
    }

    await tx.payment.update({
      where: { orderId: order.id },
      data: {
        status: "PAID",
        paidAt: paymentUpdate.paidAt || new Date(),
        provider: paymentUpdate.provider,
        providerPaymentId: paymentUpdate.providerPaymentId,
        providerExternalReference: paymentUpdate.providerExternalReference,
        providerStatus: paymentUpdate.providerStatus,
        providerStatusDetail: paymentUpdate.providerStatusDetail,
        providerPayload: paymentUpdate.providerPayload,
        lastWebhookAt: paymentUpdate.lastWebhookAt,
        syncError: null
      }
    });

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, payment: true }
    });
  });

  await createOrderNotificationSafely("ORDER_PAID", order);
  return order;
}

export async function simulatePayment(orderNumber: string) {
  return markOrderPaid(orderNumber, { provider: "SIMULATED" });
}
