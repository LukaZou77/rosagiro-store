import {
  formatPlainBrl,
  formatWholesalePackage,
  parseStandardWholesaleDescription,
  wholesalePackageConsultText
} from "@/lib/product-price-adjustment";

export type WholesaleProductDetails = {
  baseBoxPieces?: number | null;
  suggestedQuantity?: number | null;
  kitRecommendation?: string | null;
  wholesalePackage?: string | null;
  validityNote?: string | null;
  purchaseNote?: string | null;
};

type WholesalePackageInput = Pick<WholesaleProductDetails, "baseBoxPieces" | "wholesalePackage"> & {
  descriptionPt?: string | null;
};

type WholesaleStockInput = {
  inventory?: { quantity: number } | null;
  skus?: Array<{ quantity: number; active: boolean }>;
};

export type ProductWholesaleLine = {
  key: keyof WholesaleProductDetails;
  label: string;
  value: string;
  fallback: boolean;
};

function clean(value: string | null | undefined) {
  return value?.trim() || "";
}

function customerWholesalePackageText(value: string) {
  return value
    .replace(/^Caixa\s+fechada/i, "Embalagem fechada")
    .replace(/^Caixa\s+com/i, "Embalagem fechada com");
}

export function productWholesalePackagePieces(product: WholesalePackageInput) {
  const storedPieces = Math.floor(Number(product.baseBoxPieces) || 0);
  if (storedPieces > 0) return storedPieces;

  const parsedDescription = parseStandardWholesaleDescription(product.descriptionPt || "");
  if (parsedDescription.boxPieces) return parsedDescription.boxPieces;

  const packageText = clean(product.wholesalePackage);
  const packageMatch = packageText.match(/(?:caixa|embalagem)[^\d]{0,24}(\d+)\s*(?:unidades?|un\.?|p[çc]s?)/i);
  return packageMatch ? Math.max(1, Number(packageMatch[1])) : null;
}

export function productWholesalePackageLabel(product: WholesalePackageInput) {
  const pieces = productWholesalePackagePieces(product);
  return pieces ? `Embalagem fechada com ${pieces} unidades` : "Embalagem fechada sob consulta";
}

export function productWholesaleStockQuantity(product: WholesaleStockInput) {
  if (product.inventory) return Math.max(0, product.inventory.quantity);

  return (product.skus || []).reduce(
    (total, sku) => (sku.active ? total + Math.max(0, sku.quantity) : total),
    0
  );
}

export function wholesalePackageFromLegacyDescription(description: string) {
  const parsed = parseStandardWholesaleDescription(description);
  if (!parsed.matched) return null;
  if (parsed.whatsappBox || !parsed.boxPriceCents || !parsed.boxPieces) {
    return wholesalePackageConsultText;
  }
  return formatWholesalePackage(parsed.boxPriceCents, parsed.boxPieces);
}

export function productCommercialSummary(product: {
  priceCents: number;
  baseBoxPieces?: number | null;
  wholesalePackage?: string | null;
  descriptionPt: string;
}) {
  const legacyPackage = wholesalePackageFromLegacyDescription(product.descriptionPt);
  const packageText = customerWholesalePackageText(
    legacyPackage || clean(product.wholesalePackage) || wholesalePackageConsultText
  );
  return `Preço unitário no atacado: R$ ${formatPlainBrl(product.priceCents)}. ${packageText}`;
}

export function productEditorialDescription(description: string) {
  return parseStandardWholesaleDescription(description).matched ? "" : description.trim();
}

export function productWholesaleLines(product: WholesaleProductDetails): ProductWholesaleLine[] {
  return [
    {
      key: "wholesalePackage",
      label: "Condição de atacado",
      value: clean(product.wholesalePackage)
        ? customerWholesalePackageText(clean(product.wholesalePackage))
        : "Sob consulta",
      fallback: !clean(product.wholesalePackage)
    },
    {
      key: "validityNote",
      label: "Validade/lote",
      value: clean(product.validityNote) || "Confirmar no atendimento",
      fallback: !clean(product.validityNote)
    },
    {
      key: "purchaseNote",
      label: "Observação",
      value: clean(product.purchaseNote) || "Confirme estoque antes de fechar volume",
      fallback: !clean(product.purchaseNote)
    }
  ];
}

export function productWholesaleWhatsAppLines(product: WholesaleProductDetails) {
  return productWholesaleLines(product)
    .filter((line) => !line.fallback && line.key !== "purchaseNote")
    .map((line) => `${line.label}: ${line.value}`);
}
