import "server-only";

import { Buffer } from "node:buffer";
import { readSheet, type Row } from "read-excel-file/node";
import { cepDigits, formatCep } from "@/lib/cep";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import type { Prisma, ShippingMethod } from "@/src/generated/prisma/client";

export const shippingConfig = {
  carrier: "ANJUN",
  service: "D2D_PICKUP",
  serviceLabel: "Anjun D2D Pickup",
  originKey: "SP_SAO_PAULO",
  originLabel: "SP-São Paulo",
  originDisplay: "SP - São Paulo",
  pickupLabel: "Retirada local",
  packagingWeightGrams: 150,
  minBillableWeightGrams: 100,
  fallbackProductWeightGrams: 150,
  freeShippingEnabled: false,
  manualFeesNote: "Base do frete calculada por CEP e peso. Seguro, ICMS/ISS e área de risco podem exigir confirmação manual."
} as const;

export const anjunD2DPickupSheetName = "安骏快递价格表D2D Pickup";

const weightBands = [
  { maxGrams: 100, label: "0,001-0,1 kg" },
  { maxGrams: 250, label: "0,101-0,25 kg" },
  { maxGrams: 500, label: "0,251-0,5 kg" },
  { maxGrams: 1000, label: "0,501-1 kg" },
  { maxGrams: 1500, label: "1,001-1,5 kg" },
  { maxGrams: 2000, label: "1,501-2 kg" },
  { maxGrams: 2500, label: "2,001-2,5 kg" },
  { maxGrams: 3000, label: "2,501-3 kg" },
  { maxGrams: 4000, label: "3,001-4 kg" },
  { maxGrams: 5000, label: "4,001-5 kg" },
  { maxGrams: 6000, label: "5,001-6 kg" },
  { maxGrams: 7000, label: "6,001-7 kg" },
  { maxGrams: 8000, label: "7,001-8 kg" },
  { maxGrams: 9000, label: "8,001-9 kg" },
  { maxGrams: 10000, label: "9,001-10 kg" }
] as const;

type AnjunRateInput = {
  originKey: string;
  originLabel: string;
  destinationState: string;
  city: string;
  cepStart: number;
  cepEnd: number;
  zone: string;
  ratesCents: number[];
  additionalKgCents: number;
};

export type AnjunImportSummary = {
  sourceName: string;
  sourceSheet: string;
  workbookRows: number;
  importableRows: number;
  stateCount: number;
  zoneCount: number;
  originCount: number;
  sampleCep: string;
  sampleRateCents: number | null;
};

export type AnjunImportPreview = {
  summary: AnjunImportSummary;
  errors: string[];
  canImport: boolean;
};

type AnjunParseResult = AnjunImportPreview & {
  rates: AnjunRateInput[];
};

export type ShippingQuoteCartItem = {
  slug: string;
  quantity: number;
};

export type ShippingQuoteOption = {
  method: Extract<ShippingMethod, "ANJUN_D2D_PICKUP" | "RETIRADA_LOCAL">;
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
  status: "OK" | "NO_RATE" | "INVALID_CEP" | "EMPTY_CART" | "ERROR";
  message: string;
  options: ShippingQuoteOption[];
  productWeightGrams: number;
  billableWeightGrams: number;
};

export type ResolvedOrderShipping = {
  method: ShippingMethod;
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

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function parseCepNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  const digits = cleanText(value).replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function parseMoneyCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  const raw = cleanText(value).replace(/[R$\s]/gi, "");
  if (!raw || raw === "-") return 0;
  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function formatWeight(grams: number) {
  return `${(grams / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`;
}

function publicZoneLabel(zone: string) {
  return zone.replace(/\s*[\u3400-\u9fff].*$/u, "").trim() || zone;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function parseAnjunRow(row: Row, rowNumber: number, errors: string[]): AnjunRateInput | null {
  const originLabel = cleanText(row[0]);
  const destinationState = cleanText(row[1]).toUpperCase();
  const city = cleanText(row[2]);
  const cepStart = parseCepNumber(row[3]);
  const cepEnd = parseCepNumber(row[4]);
  const zone = cleanText(row[5]);
  const ratesCents = row.slice(6, 21).map(parseMoneyCents);
  const additionalKgCents = parseMoneyCents(row[21]);

  if (!originLabel && !destinationState && !city) return null;

  const rowErrors: string[] = [];
  if (!originLabel) rowErrors.push("origin vazio");
  if (destinationState.length !== 2) rowErrors.push("UF inválida");
  if (!city) rowErrors.push("cidade vazia");
  if (!cepStart || !cepEnd || cepStart > cepEnd) rowErrors.push("CEP inicial/final inválido");
  if (!zone) rowErrors.push("zona vazia");
  if (ratesCents.length !== weightBands.length || ratesCents.some((rate) => rate <= 0)) {
    rowErrors.push("faixas de peso inválidas");
  }
  if (additionalKgCents <= 0) rowErrors.push("kg adicional inválido");

  if (rowErrors.length) {
    if (errors.length < 30) errors.push(`Linha ${rowNumber}: ${rowErrors.join(", ")}`);
    return null;
  }

  return {
    originKey: normalizeKey(originLabel),
    originLabel,
    destinationState,
    city,
    cepStart,
    cepEnd,
    zone,
    ratesCents,
    additionalKgCents
  };
}

export async function parseAnjunD2DPickupWorkbook(buffer: Buffer, sourceName: string): Promise<AnjunParseResult> {
  const errors: string[] = [];
  let rows: Row[] = [];

  try {
    rows = await readSheet(buffer, anjunD2DPickupSheetName);
  } catch {
    rows = [];
    errors.push(`A planilha "${anjunD2DPickupSheetName}" não foi encontrada no XLSX.`);
  }

  const workbookRows = Math.max(0, rows.length - 2);
  const rates = rows
    .slice(2)
    .map((row, index) => parseAnjunRow(row, index + 3, errors))
    .filter((rate): rate is AnjunRateInput => Boolean(rate));
  const states = new Set(rates.map((rate) => rate.destinationState));
  const zones = new Set(rates.map((rate) => rate.zone));
  const origins = new Set(rates.map((rate) => rate.originKey));
  const sample = rates.find((rate) => rate.originKey === shippingConfig.originKey && rate.cepStart <= 1001000 && rate.cepEnd >= 1001000);

  if (!rates.length && !errors.length) errors.push("Nenhuma linha válida foi encontrada no D2D Pickup.");

  return {
    summary: {
      sourceName,
      sourceSheet: anjunD2DPickupSheetName,
      workbookRows,
      importableRows: rates.length,
      stateCount: states.size,
      zoneCount: zones.size,
      originCount: origins.size,
      sampleCep: "01001-000",
      sampleRateCents: sample?.ratesCents[0] ?? null
    },
    rates,
    errors,
    canImport: rates.length > 0 && errors.length === 0
  };
}

export async function importAnjunD2DPickupRates(buffer: Buffer, sourceName: string) {
  const parsed = await parseAnjunD2DPickupWorkbook(buffer, sourceName);
  if (!parsed.canImport) {
    throw new Error(parsed.errors[0] || "Corrija o arquivo antes de importar.");
  }

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.shippingRate.updateMany({
        where: { carrier: shippingConfig.carrier, service: shippingConfig.service, active: true },
        data: { active: false }
      });
      await tx.shippingRateImport.updateMany({
        where: { carrier: shippingConfig.carrier, service: shippingConfig.service, active: true },
        data: { active: false }
      });

      const batch = await tx.shippingRateImport.create({
        data: {
          carrier: shippingConfig.carrier,
          service: shippingConfig.service,
          sourceName,
          sourceSheet: anjunD2DPickupSheetName,
          originKey: "ALL",
          originLabel: "Todas as origens D2D Pickup",
          versionLabel: "2026-01-01",
          effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
          rowCount: parsed.summary.importableRows,
          stateCount: parsed.summary.stateCount,
          zoneCount: parsed.summary.zoneCount,
          active: false
        }
      });

      for (const group of chunk(parsed.rates, 1000)) {
        await tx.shippingRate.createMany({
          data: group.map((rate) => ({
            importId: batch.id,
            carrier: shippingConfig.carrier,
            service: shippingConfig.service,
            originKey: rate.originKey,
            originLabel: rate.originLabel,
            destinationState: rate.destinationState,
            city: rate.city,
            cepStart: rate.cepStart,
            cepEnd: rate.cepEnd,
            zone: rate.zone,
            ratesCents: rate.ratesCents,
            additionalKgCents: rate.additionalKgCents,
            active: true
          }))
        });
      }

      return tx.shippingRateImport.update({
        where: { id: batch.id },
        data: { active: true }
      });
    },
    { timeout: 120000 }
  );

  return {
    batchId: result.id,
    summary: parsed.summary
  };
}

export function productWeightGrams(weightGrams: number | null | undefined) {
  if (!weightGrams || weightGrams <= 0) return shippingConfig.fallbackProductWeightGrams;
  return Math.max(1, Math.floor(weightGrams));
}

export function billableWeightGrams(productTotalWeightGrams: number) {
  return Math.max(
    shippingConfig.minBillableWeightGrams,
    productTotalWeightGrams + shippingConfig.packagingWeightGrams
  );
}

export function rateCentsForWeight(ratesCents: number[], additionalKgCents: number, weightGrams: number) {
  const bandIndex = weightBands.findIndex((band) => weightGrams <= band.maxGrams);
  if (bandIndex >= 0) {
    return ratesCents[bandIndex] || 0;
  }

  const base = ratesCents[weightBands.length - 1] || 0;
  const extraKg = Math.ceil((weightGrams - 10000) / 1000);
  return base + Math.max(0, extraKg) * additionalKgCents;
}

function localPickupOption(productTotalWeightGrams: number, billable: number): ShippingQuoteOption {
  return {
    method: "RETIRADA_LOCAL",
    carrier: "BELA_VIVA",
    service: "RETIRADA_LOCAL",
    label: shippingConfig.pickupLabel,
    priceCents: 0,
    billableWeightGrams: billable,
    productWeightGrams: productTotalWeightGrams,
    rateId: null,
    zone: null,
    city: null,
    state: null,
    estimate: "Combinar retirada pelo atendimento",
    note: "Retirada local sem cobrança de frete, mediante confirmação de horário e disponibilidade."
  };
}

export async function quoteAnjunD2DPickup(cep: string, productTotalWeightGrams: number) {
  const digits = cepDigits(cep);
  const billable = billableWeightGrams(productTotalWeightGrams);
  if (digits.length !== 8) return null;

  const cepNumber = Number(digits);
  const rate = await prisma.shippingRate.findFirst({
    where: {
      active: true,
      carrier: shippingConfig.carrier,
      service: shippingConfig.service,
      originKey: shippingConfig.originKey,
      cepStart: { lte: cepNumber },
      cepEnd: { gte: cepNumber },
      import: { active: true }
    },
    orderBy: [{ cepStart: "desc" }, { cepEnd: "asc" }]
  });

  if (!rate) return null;

  const priceCents = rateCentsForWeight(rate.ratesCents, rate.additionalKgCents, billable);
  if (priceCents <= 0) return null;
  const zone = publicZoneLabel(rate.zone);

  return {
    method: "ANJUN_D2D_PICKUP" as const,
    carrier: shippingConfig.carrier,
    service: shippingConfig.service,
    label: shippingConfig.serviceLabel,
    priceCents,
    billableWeightGrams: billable,
    productWeightGrams: productTotalWeightGrams,
    rateId: rate.id,
    zone,
    city: rate.city,
    state: rate.destinationState,
    estimate: "Prazo confirmado após separação",
    note: `${shippingConfig.originDisplay} -> ${rate.city}/${rate.destinationState}, zona ${zone}. ${shippingConfig.manualFeesNote}`
  } satisfies ShippingQuoteOption;
}

function normalizeQuoteItems(items: ShippingQuoteCartItem[]) {
  const bySlug = new Map<string, number>();
  for (const item of items) {
    const slug = cleanText(item.slug);
    const quantity = Math.max(1, Math.min(20, Math.floor(Number(item.quantity) || 0)));
    if (!slug || quantity <= 0) continue;
    bySlug.set(slug, (bySlug.get(slug) || 0) + quantity);
  }
  return Array.from(bySlug, ([slug, quantity]) => ({ slug, quantity }));
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

  const digits = cepDigits(cep);
  const products = await prisma.product.findMany({
    where: { slug: { in: normalizedItems.map((item) => item.slug) }, active: true, deletedAt: null },
    select: { slug: true, weightGrams: true }
  });
  const productBySlug = new Map(products.map((product) => [product.slug, product]));
  if (!productBySlug.size) {
    return {
      status: "EMPTY_CART",
      message: "Adicione produtos disponíveis ao carrinho para calcular o frete.",
      options: [],
      productWeightGrams: 0,
      billableWeightGrams: shippingConfig.minBillableWeightGrams
    };
  }
  const productTotalWeightGrams = normalizedItems.reduce((total, item) => {
    const product = productBySlug.get(item.slug);
    return product ? total + productWeightGrams(product.weightGrams) * item.quantity : total;
  }, 0);
  const billable = billableWeightGrams(productTotalWeightGrams);
  const pickup = localPickupOption(productTotalWeightGrams, billable);

  if (digits.length !== 8) {
    return {
      status: "INVALID_CEP",
      message: "Informe um CEP com 8 dígitos para calcular Anjun D2D Pickup.",
      options: [pickup],
      productWeightGrams: productTotalWeightGrams,
      billableWeightGrams: billable
    };
  }

  const anjun = await quoteAnjunD2DPickup(digits, productTotalWeightGrams);
  const options = anjun ? [anjun, pickup] : [pickup];

  return {
    status: anjun ? "OK" : "NO_RATE",
    message: anjun
      ? `Frete base encontrado para ${formatCep(digits)}. Peso cobrado: ${formatWeight(billable)}.`
      : "Não encontramos tabela Anjun para este CEP. Use retirada local ou fale no WhatsApp.",
    options,
    productWeightGrams: productTotalWeightGrams,
    billableWeightGrams: billable
  };
}

function legacyShippingCents(subtotal: number, method: ShippingMethod) {
  if (subtotal >= 29900) return 0;
  return method === "EXPRESSA" ? 2490 : 1490;
}

function snapshotFromOption(option: ShippingQuoteOption): Prisma.InputJsonValue {
  return {
    carrier: option.carrier,
    service: option.service,
    serviceLabel: option.label,
    method: option.method,
    rateId: option.rateId,
    zone: option.zone,
    city: option.city,
    state: option.state,
    productWeightGrams: option.productWeightGrams,
    billableWeightGrams: option.billableWeightGrams,
    priceCents: option.priceCents,
    price: money(option.priceCents),
    estimate: option.estimate,
    note: option.note
  };
}

export async function resolveOrderShipping({
  method,
  cep,
  subtotal,
  lines
}: {
  method: ShippingMethod;
  cep: string;
  subtotal: number;
  lines: Array<{ weightGrams: number | null; quantity: number }>;
}): Promise<ResolvedOrderShipping> {
  const productTotalWeightGrams = lines.reduce(
    (total, line) => total + productWeightGrams(line.weightGrams) * line.quantity,
    0
  );
  const billable = billableWeightGrams(productTotalWeightGrams);

  if (method === "RETIRADA_LOCAL") {
    const option = localPickupOption(productTotalWeightGrams, billable);
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

  if (method === "ANJUN_D2D_PICKUP") {
    const option = await quoteAnjunD2DPickup(cep, productTotalWeightGrams);
    if (!option) {
      throw new Error("Não foi possível calcular Anjun D2D Pickup para este CEP. Escolha retirada local ou fale no WhatsApp.");
    }
    return {
      method,
      shippingCents: option.priceCents,
      carrier: option.carrier,
      service: option.service,
      serviceLabel: option.label,
      rateId: option.rateId,
      zone: option.zone,
      city: option.city,
      weightGrams: option.billableWeightGrams,
      estimate: option.estimate,
      status: "QUOTED",
      message: option.note,
      snapshot: snapshotFromOption(option)
    };
  }

  const shipping = legacyShippingCents(subtotal, method);
  return {
    method,
    shippingCents: shipping,
    carrier: "LEGACY",
    service: method,
    serviceLabel: method === "EXPRESSA" ? "Entrega expressa legada" : "Entrega padrão legada",
    rateId: null,
    zone: null,
    city: null,
    weightGrams: billable,
    estimate: method === "EXPRESSA" ? "2 a 3 dias úteis (legado)" : "4 a 7 dias úteis (legado)",
    status: "LEGACY",
    message: "Pedido criado por fluxo antigo de frete fixo.",
    snapshot: {
      method,
      priceCents: shipping,
      productWeightGrams: productTotalWeightGrams,
      billableWeightGrams: billable,
      legacy: true
    }
  };
}
