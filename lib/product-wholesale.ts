import {
  formatPlainBrl,
  formatWholesalePackage,
  parseStandardWholesaleDescription,
  wholesalePackageConsultText
} from "@/lib/product-price-adjustment";

export type WholesaleProductDetails = {
  suggestedQuantity?: number | null;
  kitRecommendation?: string | null;
  wholesalePackage?: string | null;
  validityNote?: string | null;
  purchaseNote?: string | null;
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
  wholesalePackage?: string | null;
  descriptionPt: string;
}) {
  const legacyPackage = wholesalePackageFromLegacyDescription(product.descriptionPt);
  const packageText = legacyPackage || clean(product.wholesalePackage) || wholesalePackageConsultText;
  return `Preço unitário: R$ ${formatPlainBrl(product.priceCents)}. ${packageText}`;
}

export function productEditorialDescription(description: string) {
  return parseStandardWholesaleDescription(description).matched ? "" : description.trim();
}

export function productWholesaleLines(product: WholesaleProductDetails): ProductWholesaleLine[] {
  return [
    {
      key: "wholesalePackage",
      label: "Condição de atacado",
      value: clean(product.wholesalePackage) || "Sob consulta",
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
