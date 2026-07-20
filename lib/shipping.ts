import "server-only";

import { cepDigits, formatCep } from "@/lib/cep";
import { prisma } from "@/lib/db";
import { calculateMelhorEnvioRates, MelhorEnvioError, type MelhorEnvioProduct, type MelhorEnvioRate } from "@/lib/melhor-envio";
import { money } from "@/lib/money";
import {
  billableWeightGrams,
  productShippingProfile,
  shippingWeightConfig,
  type CheckoutShippingMethod
} from "@/lib/shipping-rules";
import type { Prisma } from "@/src/generated/prisma/client";

export { billableWeightGrams, productWeightGrams } from "@/lib/shipping-rules";

export const shippingConfig = {
  carrier: "MELHOR_ENVIO",
  serviceLabel: "Melhor Envio",
  originLabel: "São Paulo/SP",
  pickupLabel: "Retirada local",
  ...shippingWeightConfig,
  freeShippingEnabled: false
} as const;

export type ShippingQuoteCartItem = {
  slug: string;
  skuId?: string;
  quantity: number;
};

export type ShippingQuoteOption = {
  selectionKey: string;
  method: CheckoutShippingMethod;
  carrier: string;
  service: string;
  label: string;
  priceCents: number;
  billableWeightGrams: number;
  productWeightGrams: number;
  rateId: string | null;
  zone: string | null;
  city: string | null;
  state: string | null;
  estimate: string;
  note: string;
};

export type ShippingQuoteResult = {
  status: "OK" | "NO_RATE" | "INVALID_CEP" | "EMPTY_CART" | "CONFIGURATION_REQUIRED" | "ERROR";
  message: string;
  options: ShippingQuoteOption[];
  productWeightGrams: number;
  billableWeightGrams: number;
};

export type ResolvedOrderShipping = {
  method: CheckoutShippingMethod;
  shippingCents: number;
  carrier: string | null;
  service: string | null;
  serviceLabel: string | null;
  rateId: string | null;
  zone: string | null;
  city: string | null;
  weightGrams: number;
  estimate: string | null;
  status: string;
  message: string;
  snapshot: Prisma.InputJsonValue;
};

type OrderShippingLine = {
  productSlug: string;
  productName: string;
  categorySlug: string | null;
  weightGrams: number | null;
  unitPriceCents: number;
  quantity: number;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function formatWeight(grams: number) {
  return `${(grams / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`;
}

function deliveryEstimate(rate: MelhorEnvioRate) {
  if (rate.deliveryMinDays && rate.deliveryMaxDays && rate.deliveryMinDays !== rate.deliveryMaxDays) {
    return `${rate.deliveryMinDays} a ${rate.deliveryMaxDays} dias úteis`;
  }
  const days = rate.deliveryMaxDays || rate.deliveryMinDays;
  return days ? `${days} dias úteis` : "Prazo informado pela transportadora";
}

function localPickupOption(productTotalWeightGrams: number, billable: number): ShippingQuoteOption {
  return {
    selectionKey: "RETIRADA_LOCAL",
    method: "RETIRADA_LOCAL",
    carrier: "ROSAGIRO",
    service: "RETIRADA_LOCAL",
    label: shippingConfig.pickupLabel,
    priceCents: 0,
    billableWeightGrams: billable,
    productWeightGrams: productTotalWeightGrams,
    rateId: null,
    zone: null,
    city: null,
    state: null,
    estimate: "Combine a unidade e o horário com o atendimento",
    note: "Retirada sem frete, disponível somente após confirmação da unidade, do estoque e do horário."
  };
}

function melhorEnvioOption(rate: MelhorEnvioRate, productTotalWeightGrams: number, billable: number): ShippingQuoteOption {
  const estimate = deliveryEstimate(rate);
  return {
    selectionKey: `MELHOR_ENVIO:${rate.serviceId}`,
    method: "MELHOR_ENVIO",
    carrier: rate.carrierName,
    service: rate.serviceName,
    label: `${rate.carrierName} - ${rate.serviceName}`,
    priceCents: rate.priceCents,
    billableWeightGrams: billable,
    productWeightGrams: productTotalWeightGrams,
    rateId: rate.serviceId,
    zone: null,
    city: null,
    state: null,
    estimate,
    note: `Frete de ${money(rate.priceCents)} com prazo estimado de ${estimate}, calculado online pela Melhor Envio.`
  };
}

function normalizeQuoteItems(items: ShippingQuoteCartItem[]) {
  const byLine = new Map<string, ShippingQuoteCartItem>();
  for (const item of items) {
    const slug = cleanText(item.slug);
    const skuId = cleanText(item.skuId) || undefined;
    const quantity = Math.max(1, Math.min(20, Math.floor(Number(item.quantity) || 0)));
    if (!slug || quantity <= 0) continue;
    const key = `${slug}::${skuId || ""}`;
    const existing = byLine.get(key);
    if (existing) existing.quantity = Math.min(20, existing.quantity + quantity);
    else byLine.set(key, { slug, skuId, quantity });
  }
  return Array.from(byLine.values());
}

function melhorEnvioProducts(lines: OrderShippingLine[]): { products: MelhorEnvioProduct[]; productTotalWeightGrams: number } {
  let productTotalWeightGrams = 0;
  const products = lines.map((line) => {
    const profile = productShippingProfile({
      name: line.productName,
      categorySlug: line.categorySlug,
      weightGrams: line.weightGrams
    });
    productTotalWeightGrams += profile.weightGrams * line.quantity;
    return {
      id: line.productSlug,
      width: profile.widthCm,
      height: profile.heightCm,
      length: profile.lengthCm,
      weight: Number((profile.weightGrams / 1000).toFixed(3)),
      insurance_value: Number((line.unitPriceCents / 100).toFixed(2)),
      quantity: line.quantity
    } satisfies MelhorEnvioProduct;
  });

  return { products, productTotalWeightGrams };
}

async function quoteRemoteOptions(cep: string, lines: OrderShippingLine[]) {
  const { products, productTotalWeightGrams } = melhorEnvioProducts(lines);
  const billable = billableWeightGrams(productTotalWeightGrams);
  const rates = await calculateMelhorEnvioRates({ destinationCep: cep, products });
  return {
    productTotalWeightGrams,
    billable,
    options: rates.slice(0, 8).map((rate) => melhorEnvioOption(rate, productTotalWeightGrams, billable))
  };
}

export async function getShippingQuoteForCart(items: ShippingQuoteCartItem[], cep: string): Promise<ShippingQuoteResult> {
  const normalizedItems = normalizeQuoteItems(items);
  if (!normalizedItems.length) {
    return {
      status: "EMPTY_CART",
      message: "Adicione produtos ao carrinho para calcular o frete.",
      options: [],
      productWeightGrams: 0,
      billableWeightGrams: shippingConfig.minBillableWeightGrams
    };
  }

  const products = await prisma.product.findMany({
    where: { slug: { in: normalizedItems.map((item) => item.slug) }, active: true, deletedAt: null },
    select: {
      slug: true,
      name: true,
      priceCents: true,
      weightGrams: true,
      category: { select: { slug: true } },
      skus: { where: { active: true }, select: { id: true, priceCents: true } }
    }
  });
  const productBySlug = new Map(products.map((product) => [product.slug, product]));
  const lines: OrderShippingLine[] = [];

  for (const item of normalizedItems) {
    const product = productBySlug.get(item.slug);
    if (!product) continue;
    const sku = item.skuId ? product.skus.find((candidate) => candidate.id === item.skuId) : null;
    if (item.skuId && !sku) continue;
    lines.push({
      productSlug: item.skuId ? `${product.slug}:${item.skuId}` : product.slug,
      productName: product.name,
      categorySlug: product.category.slug,
      weightGrams: product.weightGrams,
      unitPriceCents: sku?.priceCents ?? product.priceCents,
      quantity: item.quantity
    });
  }

  if (!lines.length || lines.length !== normalizedItems.length) {
    return {
      status: "EMPTY_CART",
      message: "Revise os produtos e as variações antes de calcular o frete.",
      options: [],
      productWeightGrams: 0,
      billableWeightGrams: shippingConfig.minBillableWeightGrams
    };
  }

  const digits = cepDigits(cep);
  const localProfile = melhorEnvioProducts(lines);
  const billable = billableWeightGrams(localProfile.productTotalWeightGrams);
  const pickup = localPickupOption(localProfile.productTotalWeightGrams, billable);
  if (digits.length !== 8) {
    return {
      status: "INVALID_CEP",
      message: "Informe um CEP com 8 dígitos para calcular a entrega.",
      options: [pickup],
      productWeightGrams: localProfile.productTotalWeightGrams,
      billableWeightGrams: billable
    };
  }

  try {
    const remote = await quoteRemoteOptions(digits, lines);
    return {
      status: remote.options.length ? "OK" : "NO_RATE",
      message: remote.options.length
        ? `Opções para ${formatCep(digits)}. Peso técnico estimado: ${formatWeight(remote.billable)}.`
        : "Nenhuma transportadora retornou preço para este CEP. A retirada permanece disponível mediante confirmação.",
      options: [...remote.options, pickup],
      productWeightGrams: remote.productTotalWeightGrams,
      billableWeightGrams: remote.billable
    };
  } catch (error) {
    const configurationRequired = error instanceof MelhorEnvioError && error.code === "NOT_CONFIGURED";
    return {
      status: configurationRequired ? "CONFIGURATION_REQUIRED" : "ERROR",
      message: configurationRequired
        ? "A cotação de entrega está temporariamente indisponível. Escolha retirada somente se realmente puder retirar o pedido."
        : error instanceof Error
          ? error.message
          : "Não foi possível calcular a entrega agora.",
      options: [pickup],
      productWeightGrams: localProfile.productTotalWeightGrams,
      billableWeightGrams: billable
    };
  }
}

function snapshotFromOption(option: ShippingQuoteOption): Prisma.InputJsonValue {
  return {
    provider: option.method === "MELHOR_ENVIO" ? "MELHOR_ENVIO" : "ROSAGIRO",
    carrier: option.carrier,
    service: option.service,
    serviceLabel: option.label,
    method: option.method,
    rateId: option.rateId,
    productWeightGrams: option.productWeightGrams,
    billableWeightGrams: option.billableWeightGrams,
    priceCents: option.priceCents,
    price: money(option.priceCents),
    estimate: option.estimate,
    note: option.note,
    quotedAt: new Date().toISOString()
  };
}

export async function resolveOrderShipping({
  method,
  rateId,
  cep,
  lines
}: {
  method: CheckoutShippingMethod;
  rateId?: string | null;
  cep: string;
  lines: OrderShippingLine[];
}): Promise<ResolvedOrderShipping> {
  const localProfile = melhorEnvioProducts(lines);
  const billable = billableWeightGrams(localProfile.productTotalWeightGrams);

  if (method === "RETIRADA_LOCAL") {
    const option = localPickupOption(localProfile.productTotalWeightGrams, billable);
    return {
      method,
      shippingCents: 0,
      carrier: option.carrier,
      service: option.service,
      serviceLabel: option.label,
      rateId: null,
      zone: null,
      city: null,
      weightGrams: billable,
      estimate: option.estimate,
      status: "MANUAL",
      message: option.note,
      snapshot: snapshotFromOption(option)
    };
  }

  if (!rateId) throw new Error("Escolha uma opção de entrega antes de finalizar o pedido.");
  const remote = await quoteRemoteOptions(cep, lines);
  const option = remote.options.find((candidate) => candidate.rateId === rateId);
  if (!option) {
    throw new Error("A opção de entrega escolhida não está mais disponível. Calcule o frete novamente.");
  }

  return {
    method,
    shippingCents: option.priceCents,
    carrier: option.carrier,
    service: option.service,
    serviceLabel: option.label,
    rateId: option.rateId,
    zone: null,
    city: null,
    weightGrams: option.billableWeightGrams,
    estimate: option.estimate,
    status: "QUOTED",
    message: option.note,
    snapshot: snapshotFromOption(option)
  };
}
