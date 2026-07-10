export type PriceAdjustmentDirection = "none" | "increase" | "decrease";
export type PriceAdjustmentType = "percent" | "fixed";

export type PriceAdjustmentConfig = {
  direction: PriceAdjustmentDirection;
  type: PriceAdjustmentType;
  value: number;
};

export const emptyPriceAdjustment: PriceAdjustmentConfig = {
  direction: "none",
  type: "percent",
  value: 0
};

type PriceAdjustmentInput = {
  direction?: string | null;
  type?: string | null;
  value?: string | number | null;
};

type DescriptionAdjustmentResult = {
  description: string;
  matched: boolean;
  boxPriceCents: number | null;
  boxPieces: number | null;
};

type BuildAdjustedProductPricingInput = {
  basePriceCents: number;
  descriptionPt: string;
  wholesalePackage?: string | null;
  config: PriceAdjustmentConfig;
  baseBoxPriceCents?: number | null;
  baseBoxPieces?: number | null;
};

type BuildAdjustedProductPricingResult =
  | {
      ok: true;
      priceCents: number;
      descriptionPt: string;
      wholesalePackage: string;
      baseBoxPriceCents: number | null;
      baseBoxPieces: number | null;
      descriptionMatched: boolean;
    }
  | {
      ok: false;
      reason: string;
    };

const PRICE_DESCRIPTION_PATTERN =
  /Preço\s+unit[aá]rio:\s*([0-9]+(?:[,.][0-9]{1,2})?)\s*;\s*Embalagem\s+para\s+atacado:\s*(consulte\s+pelo\s+WhatsApp|([0-9]+(?:[,.][0-9]{1,2})?)\s*c\s*\/\s*(\d+)\s*p[çc]s)\.?/i;

export function parseDecimalCents(value: string | number | null | undefined) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function parseDecimalNumber(value: string | number | null | undefined) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parsePriceAdjustmentInput(input: PriceAdjustmentInput): PriceAdjustmentConfig {
  const direction = input.direction === "increase" || input.direction === "decrease" ? input.direction : "none";
  const type = input.type === "fixed" ? "fixed" : "percent";
  if (direction === "none") return { ...emptyPriceAdjustment, type };

  const value =
    type === "fixed"
      ? parseDecimalCents(input.value)
      : Math.round(parseDecimalNumber(input.value) * 100);

  if (value <= 0) return { ...emptyPriceAdjustment, type };

  return { direction, type, value };
}

export function priceAdjustmentConfigFromStoredValues(
  direction?: string | null,
  type?: string | null,
  value?: number | null
): PriceAdjustmentConfig {
  const normalizedDirection =
    direction === "increase" || direction === "decrease" ? direction : "none";
  const normalizedType = type === "fixed" ? "fixed" : "percent";
  const normalizedValue = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;

  if (normalizedDirection === "none" || normalizedValue <= 0) {
    return { ...emptyPriceAdjustment, type: normalizedType };
  }

  return {
    direction: normalizedDirection,
    type: normalizedType,
    value: normalizedValue
  };
}

export function isPriceAdjustmentEnabled(config: PriceAdjustmentConfig) {
  return config.direction !== "none" && config.value > 0;
}

export function adjustPriceCents(baseCents: number, config: PriceAdjustmentConfig) {
  if (!isPriceAdjustmentEnabled(config)) return baseCents;

  const delta =
    config.type === "fixed"
      ? config.value
      : Math.round((baseCents * config.value) / 10_000);
  const adjusted = config.direction === "increase" ? baseCents + delta : baseCents - delta;

  return adjusted >= 1 ? adjusted : null;
}

export function formatPlainBrl(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function formatBoxPrice(cents: number, pieces: number) {
  return `${formatPlainBrl(cents)}c/${pieces}pçs`;
}

export const wholesalePackageConsultText =
  "Caixa fechada e volumes maiores: consulte pelo WhatsApp.";

export function formatWholesalePackage(boxPriceCents: number, boxPieces: number) {
  return `Caixa com ${boxPieces} unidades: R$ ${formatPlainBrl(boxPriceCents)}.`;
}

export function adjustedWholesalePackage(
  baseBoxPriceCents: number | null | undefined,
  baseBoxPieces: number | null | undefined,
  config: PriceAdjustmentConfig,
  fallback?: string | null,
  forceConsult = false
) {
  if (forceConsult) return wholesalePackageConsultText;
  if (!baseBoxPriceCents || !baseBoxPieces) {
    return fallback?.trim() || wholesalePackageConsultText;
  }

  let adjustedBoxPriceCents: number | null;
  if (isPriceAdjustmentEnabled(config) && config.type === "fixed") {
    const delta = config.value * baseBoxPieces;
    adjustedBoxPriceCents =
      config.direction === "increase" ? baseBoxPriceCents + delta : baseBoxPriceCents - delta;
    if (adjustedBoxPriceCents < 1) adjustedBoxPriceCents = null;
  } else {
    adjustedBoxPriceCents = adjustPriceCents(baseBoxPriceCents, config);
  }

  return adjustedBoxPriceCents
    ? formatWholesalePackage(adjustedBoxPriceCents, baseBoxPieces)
    : fallback?.trim() || wholesalePackageConsultText;
}

export function parseStandardWholesaleDescription(description: string) {
  const match = description.match(PRICE_DESCRIPTION_PATTERN);
  if (!match) {
    return {
      matched: false,
      unitPriceCents: null,
      boxPriceCents: null,
      boxPieces: null,
      whatsappBox: false
    };
  }

  return {
    matched: true,
    unitPriceCents: parseDecimalCents(match[1]),
    boxPriceCents: match[3] ? parseDecimalCents(match[3]) : null,
    boxPieces: match[4] ? Math.max(1, Number(match[4])) : null,
    whatsappBox: /whatsapp/i.test(match[2] || "")
  };
}

export function adjustStandardWholesaleDescription(
  description: string,
  baseUnitPriceCents: number,
  config: PriceAdjustmentConfig,
  baseBoxPriceCents?: number | null,
  baseBoxPieces?: number | null
): DescriptionAdjustmentResult {
  const parsed = parseStandardWholesaleDescription(description);
  if (!parsed.matched) {
    return { description, matched: false, boxPriceCents: null, boxPieces: null };
  }

  const adjustedUnit = adjustPriceCents(baseUnitPriceCents, config);
  if (!adjustedUnit) {
    return { description, matched: true, boxPriceCents: parsed.boxPriceCents, boxPieces: parsed.boxPieces };
  }

  const pieces = baseBoxPieces || parsed.boxPieces;
  const boxBase = baseBoxPriceCents || parsed.boxPriceCents;
  let adjustedBox: number | null = null;
  if (pieces && boxBase) {
    if (isPriceAdjustmentEnabled(config) && config.type === "fixed") {
      const delta = config.value * pieces;
      adjustedBox = config.direction === "increase" ? boxBase + delta : boxBase - delta;
      if (adjustedBox < 1) adjustedBox = null;
    } else {
      adjustedBox = adjustPriceCents(boxBase, config);
    }
  }

  const boxText = parsed.whatsappBox || !pieces || !adjustedBox ? "consulte pelo WhatsApp" : formatBoxPrice(adjustedBox, pieces);
  const next = `Preço unitário: ${formatPlainBrl(adjustedUnit)}; Embalagem para atacado: ${boxText}.`;

  return {
    description: description.replace(PRICE_DESCRIPTION_PATTERN, next),
    matched: true,
    boxPriceCents: boxBase,
    boxPieces: pieces
  };
}

export function buildAdjustedProductPricing({
  basePriceCents,
  descriptionPt,
  wholesalePackage,
  config,
  baseBoxPriceCents,
  baseBoxPieces
}: BuildAdjustedProductPricingInput): BuildAdjustedProductPricingResult {
  const adjustedPrice = adjustPriceCents(basePriceCents, config);
  if (!adjustedPrice) {
    return { ok: false, reason: "O ajuste deixaria o preço abaixo de R$ 0,01." };
  }

  const adjustedDescription = adjustStandardWholesaleDescription(
    descriptionPt,
    basePriceCents,
    config,
    baseBoxPriceCents,
    baseBoxPieces
  );
  const parsedDescription = parseStandardWholesaleDescription(descriptionPt);
  const resolvedBaseBoxPriceCents = adjustedDescription.boxPriceCents ?? baseBoxPriceCents ?? null;
  const resolvedBaseBoxPieces = adjustedDescription.boxPieces ?? baseBoxPieces ?? null;

  return {
    ok: true,
    priceCents: adjustedPrice,
    descriptionPt: adjustedDescription.description,
    wholesalePackage: adjustedWholesalePackage(
      resolvedBaseBoxPriceCents,
      resolvedBaseBoxPieces,
      config,
      wholesalePackage,
      parsedDescription.whatsappBox
    ),
    baseBoxPriceCents: resolvedBaseBoxPriceCents,
    baseBoxPieces: resolvedBaseBoxPieces,
    descriptionMatched: adjustedDescription.matched
  };
}

export function priceAdjustmentLabel(config: PriceAdjustmentConfig) {
  if (!isPriceAdjustmentEnabled(config)) return "Sem ajuste ativo";
  const direction = config.direction === "increase" ? "Aumentar" : "Reduzir";
  const value =
    config.type === "fixed"
      ? `R$ ${formatPlainBrl(config.value)}`
      : `${(config.value / 100).toLocaleString("pt-BR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        })}%`;

  return `${direction} ${value}`;
}
