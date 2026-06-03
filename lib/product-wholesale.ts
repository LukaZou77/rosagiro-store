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

export function productWholesaleLines(product: WholesaleProductDetails): ProductWholesaleLine[] {
  return [
    {
      key: "suggestedQuantity",
      label: "Quantidade sugerida",
      value: product.suggestedQuantity ? `${product.suggestedQuantity} un.` : "Sob consulta",
      fallback: !product.suggestedQuantity
    },
    {
      key: "kitRecommendation",
      label: "Kit recomendado",
      value: clean(product.kitRecommendation) || "Combine com itens da mesma rotina",
      fallback: !clean(product.kitRecommendation)
    },
    {
      key: "wholesalePackage",
      label: "Caixa fechada / atacado",
      value: clean(product.wholesalePackage) || "Condicao sob consulta",
      fallback: !clean(product.wholesalePackage)
    },
    {
      key: "validityNote",
      label: "Validade / lote",
      value: clean(product.validityNote) || "Confirmar no atendimento",
      fallback: !clean(product.validityNote)
    },
    {
      key: "purchaseNote",
      label: "Observacao",
      value: clean(product.purchaseNote) || "Confirme estoque antes de fechar volume",
      fallback: !clean(product.purchaseNote)
    }
  ];
}

export function productWholesaleWhatsAppLines(product: WholesaleProductDetails) {
  return productWholesaleLines(product)
    .filter((line) => !line.fallback)
    .map((line) => `${line.label}: ${line.value}`);
}
