import "server-only";

import { randomInt } from "node:crypto";
import type { CheckoutAttempt } from "@/lib/checkout-attempt";
import { checkoutOrderSelect, runCheckoutCreation } from "@/lib/checkout-idempotency";
import { createOrderNotificationSafely } from "@/lib/admin-notifications";
import { cleanCustomerName, normalizeBrazilWhatsapp, upsertCustomerFromContact } from "@/lib/customers";
import { prisma } from "@/lib/db";
import { validateCheckoutAddress } from "@/lib/google-address";
import { discountCents, money, totalCents } from "@/lib/money";
import {
  canConfirmManualPayment,
  canConfirmSimulatedPayment,
  isMercadoPagoMode,
  isPaymentMethod,
  isPaymentConfirmed,
  paymentModeForEnvironment,
  simulatedPaymentConfirmedStatus,
  simulatedPaymentEnabled,
  simulatedPaymentPendingStatus,
  type PaymentMethodValue
} from "@/lib/payments";
import { recordCreatedOrderProductMetrics, recordPaidOrderProductMetrics } from "@/lib/product-daily-metrics";
import {
  productWholesaleLineTotalCents,
  productWholesalePackagePieces,
  productWholesaleStockQuantity
} from "@/lib/product-wholesale";
import { isSourceCatalogConsultationProduct } from "@/lib/source-catalog-product";
import { hasAcceptedSeparateFreight, separateFreightForOrder } from "@/lib/freight-policy";
import { getPublicPixPaymentAccount, getStoreProfile } from "@/lib/store-profile";
import { siteConfig } from "@/lib/site-config";
import {
  normalizeWholesaleLineQuantity,
  wholesaleMinimumRemainingCents
} from "@/lib/wholesale-order";
import type { OrderAttribution } from "@/lib/commerce-analytics";
import type { Prisma } from "@/src/generated/prisma/client";

export type CartInput = {
  slug: string;
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
  freightSeparateAccepted: true;
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
  const itemsBySlug = new Map<string, CartInput>();
  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      const slug = cleanText(item.slug);
      const quantity = normalizeWholesaleLineQuantity(item.quantity);
      if (!slug || quantity <= 0) continue;
      const existing = itemsBySlug.get(slug);
      if (existing) existing.quantity = normalizeWholesaleLineQuantity(existing.quantity + quantity);
      else itemsBySlug.set(slug, { slug, quantity });
    }
  }
  const items = Array.from(itemsBySlug.values());

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

  if (!hasAcceptedSeparateFreight(data.freightSeparateAccepted)) {
    throw new OrderError("Confirme que o frete não está incluído e será combinado e pago separadamente, fora do site. Se necessário, atualize a página de pagamento.");
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
  const nameLength = cleanCustomerName(customer.name).length;
  if (nameLength < 2) throw new OrderError("Informe seu nome para continuar.");
  if (nameLength > 80) throw new OrderError("Nome muito longo. Use até 80 caracteres.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    throw new OrderError("Informe um e-mail válido.");
  }
  if (digits(customer.cpf).length !== 11) throw new OrderError("CPF deve ter 11 dígitos.");
  if (!normalizedPhone) throw new OrderError("WhatsApp deve ser do Brasil e ter DDD.");
  if (digits(address.cep).length !== 8) throw new OrderError("CEP deve ter 8 dígitos.");
  if (!address.state || !address.city || !address.district || !address.street || !address.number) {
    throw new OrderError("Preencha todos os dados de endereço.");
  }
  return { items, customer, address, freightSeparateAccepted: true, paymentMethod, attribution };
}

function makeOrderNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = randomInt(1000, 9999);
  return `RG-${stamp}-${suffix}`;
}

export async function createOrder(input: CheckoutInput, attempt: CheckoutAttempt) {
  // External/cache lookups must not hold a database transaction connection.
  const addressMatch = await validateCheckoutAddress(input.address);
  const gatewayPayment = isMercadoPagoMode(paymentModeForEnvironment()) &&
    (input.paymentMethod === "PIX" || input.paymentMethod === "CREDIT_CARD");
  const pixAccount = input.paymentMethod === "PIX" && !gatewayPayment ? getPublicPixPaymentAccount(await getStoreProfile()) : null;
  const result = await runCheckoutCreation(attempt, async (tx) => {
  if (!hasAcceptedSeparateFreight(input.freightSeparateAccepted)) {
    throw new OrderError("Confirme que o frete será combinado e pago separadamente, fora do site.");
  }
  const slugs = input.items.map((item) => item.slug);
  const products = await tx.product.findMany({
    where: { slug: { in: slugs }, active: true, deletedAt: null },
    include: {
      brand: true,
      category: true,
      inventory: true,
      skus: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }
    }
  });
  const productBySlug = new Map(products.map((product) => [product.slug, product]));

  const lines = input.items.map((item) => {
    const product = productBySlug.get(item.slug);
    if (!product) throw new OrderError("Um produto do carrinho não está mais disponível.");
    if (isSourceCatalogConsultationProduct(product)) {
      throw new OrderError(`${product.name}: confirme estoque, preço e embalagem pelo WhatsApp antes de finalizar.`);
    }
    const availableQuantity = productWholesaleStockQuantity(product);
    if (availableQuantity < item.quantity) {
      throw new OrderError(`${product.name} não tem estoque suficiente.`);
    }
    return {
      product,
      quantity: item.quantity,
      priceCents: product.priceCents,
      lineTotalCents: productWholesaleLineTotalCents(product, item.quantity),
      weightGrams: product.weightGrams,
      categorySlug: product.category.slug
    };
  });

  const quantityByProductId = new Map<string, number>();
  for (const line of lines) {
    quantityByProductId.set(line.product.id, (quantityByProductId.get(line.product.id) || 0) + line.quantity);
  }
  for (const product of products) {
    const orderedQuantity = quantityByProductId.get(product.id) || 0;
    if (!orderedQuantity) continue;
    const packagePieces = productWholesalePackagePieces(product);
    if (!packagePieces) {
      throw new OrderError(`${product.name}: confirme a embalagem fechada pelo WhatsApp antes de finalizar.`);
    }
    if (orderedQuantity % packagePieces !== 0) {
      throw new OrderError(`${product.name} é vendido em embalagem fechada com ${packagePieces} unidades.`);
    }
  }

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const remainingToMinimum = wholesaleMinimumRemainingCents(subtotal, siteConfig.wholesale.minimumOrderCents);
  if (remainingToMinimum > 0) {
    throw new OrderError(
      `O pedido mínimo para atacado é ${money(siteConfig.wholesale.minimumOrderCents)}. Adicione mais ${money(remainingToMinimum)} para continuar.`
    );
  }
  const discount = discountCents();
  const shippingQuote = separateFreightForOrder();
  const total = totalCents(subtotal, discount, shippingQuote.shippingCents);
  const customer = await upsertCustomerFromContact(input.customer.name, input.customer.phone, tx);

  const order = await tx.order.create({
    data: {
      customerId: customer.id,
      orderNumber: makeOrderNumber(),
      checkoutAttemptId: attempt.id,
      checkoutRequestHash: attempt.requestHash,
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
          productSkuId: null,
          productSlug: line.product.slug,
          productName: line.product.name,
          productBrand: line.product.brand.name,
          productImage: line.product.image,
          productSkuName: null,
          productSkuCode: null,
          unitPriceCents: line.priceCents,
          quantity: line.quantity,
          lineTotalCents: line.lineTotalCents
        }))
      },
      payment: {
        create: {
          method: input.paymentMethod,
          provider: gatewayPayment ? "MERCADO_PAGO" : "SIMULATED",
          amountCents: total,
          providerStatus: gatewayPayment ? "initialization_pending" : pixAccount ? "manual_pix_pending" : input.paymentMethod === "SIMULATED" && simulatedPaymentEnabled() ? simulatedPaymentPendingStatus : null,
          providerStatusDetail: pixAccount ? "Aguardando comprovante Pix pelo atendimento." : null,
          providerPayload: pixAccount ? (pixAccount satisfies Prisma.InputJsonValue) : undefined
        }
      }
    },
    select: checkoutOrderSelect
  });
  return order;
  }, (error) => error instanceof OrderError ? { message: error.message, status: error.status } : null);
  if (result.created) {
    await createOrderNotificationSafely("NEW_ORDER", result.order);
    await recordCreatedOrderProductMetrics(result.order.id).catch(() => undefined);
  }
  return result.order;
}

type MercadoPagoConfirmation = {
  source: "mercado_pago";
  provider: "MERCADO_PAGO";
  providerPaymentId: string;
  providerExternalReference: string;
  providerStatus: "approved";
  providerStatusDetail?: string | null;
  providerPayload?: Prisma.InputJsonValue;
  lastWebhookAt?: Date;
  paidAt?: Date;
};

type PaymentConfirmation = MercadoPagoConfirmation | { source: "manual" } | { source: "simulation" };

export async function markOrderPaid(orderNumber: string, confirmation: PaymentConfirmation) {
  if (confirmation.source === "simulation" && !simulatedPaymentEnabled()) {
    throw new OrderError("Pagamento simulado não está disponível neste ambiente.", 403);
  }
  const { order, newlyPaid } = await prisma.$transaction(async (tx) => {
    // Order status and payment evidence share the same lock across all confirmation paths.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE "orderNumber" = ${orderNumber} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { orderNumber },
      include: { items: true, payment: true }
    });
    if (!order) throw new OrderError("Pedido não encontrado.", 404);
    const payment = order.payment;
    if (!payment) throw new OrderError("Pagamento do pedido não encontrado.", 404);
    if (confirmation.source === "manual" && !canConfirmManualPayment(payment)) {
      throw new OrderError("Este pedido exige a confirmação pelo provedor de pagamento.", 403);
    }
    if (confirmation.source === "simulation" && !canConfirmSimulatedPayment(payment)) {
      throw new OrderError("Este pedido não está habilitado para testes de pagamento.", 403);
    }

    const alreadyConfirmed = confirmation.source === "simulation"
      ? payment.status === "PAID" && Boolean(payment.paidAt) && payment.providerStatus === simulatedPaymentConfirmedStatus
      : isPaymentConfirmed(payment.status, payment.paidAt, payment.providerStatus);
    if (order.status === "CANCELED" && !alreadyConfirmed) throw new OrderError("Este pedido está cancelado.");

    let paymentData: Prisma.PaymentUpdateInput = {};
    if (confirmation.source === "mercado_pago" && (!alreadyConfirmed || (
      payment.provider === "MERCADO_PAGO" && payment.providerPaymentId === confirmation.providerPaymentId
    ))) {
      paymentData = {
        provider: confirmation.provider,
        providerPaymentId: confirmation.providerPaymentId,
        providerExternalReference: confirmation.providerExternalReference,
        providerStatus: confirmation.providerStatus,
        providerStatusDetail: confirmation.providerStatusDetail,
        providerPayload: confirmation.providerPayload,
        lastWebhookAt: confirmation.lastWebhookAt,
        syncError: null
      };
    } else if (confirmation.source === "manual" && !alreadyConfirmed) {
      const isPix = payment.method === "PIX";
      paymentData = {
        providerPaymentId: `manual-${isPix ? "pix" : "transfer"}-${orderNumber}`,
        providerExternalReference: orderNumber,
        providerStatus: isPix ? "manual_pix_confirmed" : "manual_transfer_confirmed",
        providerStatusDetail: isPix ? "Recebimento do Pix conferido no admin." : "Recebimento da transferência conferido no admin.",
        syncError: null
      };
    } else if (confirmation.source === "simulation" && !alreadyConfirmed) {
      paymentData = { providerStatus: simulatedPaymentConfirmedStatus, syncError: null };
    }

    if (!alreadyConfirmed) {
      paymentData.status = "PAID";
      paymentData.paidAt = (confirmation.source === "mercado_pago" && confirmation.paidAt) || new Date();
    }
    if (Object.keys(paymentData).length) {
      await tx.payment.update({ where: { orderId: order.id }, data: paymentData });
    }
    if (order.status === "PENDING_PAYMENT") {
      await tx.order.update({ where: { id: order.id }, data: { status: "PAID" } });
    }
    return {
      order: await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true, payment: true }
      }),
      newlyPaid: !alreadyConfirmed && confirmation.source !== "simulation"
    };
  });

  if (newlyPaid) {
    await createOrderNotificationSafely("ORDER_PAID", order);
    await recordPaidOrderProductMetrics(order.id).catch(() => undefined);
  }
  return order;
}

export async function simulatePayment(orderNumber: string) {
  return markOrderPaid(orderNumber, { source: "simulation" });
}
