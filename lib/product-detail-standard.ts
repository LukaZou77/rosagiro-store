import type { CatalogProduct } from "@/lib/catalog";
import { money } from "@/lib/money";
import { productQuantity, productStockLabel, productStockTone } from "@/lib/product-conversion";

export type ProductDetailTone = "ready" | "review" | "assist";

export type ProductDetailSignal = {
  label: string;
  value: string;
  tone: ProductDetailTone;
};

export type ProductDetailInfoItem = {
  label: string;
  value: string;
};

export type ProductDetailServiceCard = {
  label: string;
  value: string;
  tone: ProductDetailTone;
};

function clean(value: string | null | undefined) {
  return value?.trim() || "";
}

function friendly(value: string | null | undefined, fallback = "Confirmar no atendimento") {
  return clean(value) || fallback;
}

export function productDetailGalleryState(gallery: string[]) {
  const count = gallery.filter(Boolean).length;
  return {
    count,
    isRich: count >= 3,
    label: count === 1 ? "1 foto cadastrada" : `${count} fotos cadastradas`
  };
}

export function productDetailDecisionSignals(product: CatalogProduct, minimumOrderCents: number): ProductDetailSignal[] {
  const quantity = productQuantity(product);
  const stockTone = productStockTone(product);

  return [
    {
      label: "Estoque",
      value: productStockLabel(product),
      tone: stockTone === "ready" ? "ready" : stockTone === "low" ? "review" : "assist"
    },
    {
      label: "Pedido minimo",
      value: money(minimumOrderCents),
      tone: "assist"
    },
    {
      label: "Compra sugerida",
      value: product.suggestedQuantity ? `${product.suggestedQuantity} un.` : "Sob consulta",
      tone: product.suggestedQuantity ? "ready" : "assist"
    },
    {
      label: "Validade/lote",
      value: friendly(product.validityNote),
      tone: clean(product.validityNote) ? "review" : "assist"
    },
    {
      label: "Reposicao",
      value: quantity > 0 ? "Pronta entrega" : "Consultar disponibilidade",
      tone: quantity > 0 ? "ready" : "assist"
    }
  ];
}

export function productDetailInfoItems(product: CatalogProduct): ProductDetailInfoItem[] {
  return [
    { label: "Marca", value: product.brand.name },
    { label: "Categoria", value: product.category.label },
    { label: "Linha", value: product.subcategory },
    { label: "Volume / tamanho", value: friendly(product.volume) },
    { label: "Tipo / uso", value: friendly(product.skinType) },
    { label: "Acabamento / textura", value: friendly(product.finish) },
    { label: "Peso para frete", value: product.weightGrams > 0 ? `${product.weightGrams} g` : "Confirmar no atendimento" },
    { label: "Atacado / caixa", value: friendly(product.wholesalePackage) }
  ];
}

export function productDetailServiceCards(product: CatalogProduct): ProductDetailServiceCard[] {
  return [
    {
      label: "Frete por CEP",
      value: "Anjun D2D Pickup no checkout; transportadora e excursao sob consulta.",
      tone: "ready"
    },
    {
      label: "WhatsApp",
      value: "Confirme estoque, lote, volume e melhor entrega antes de comprar em quantidade.",
      tone: "ready"
    },
    {
      label: "Kit / combinacao",
      value: friendly(product.kitRecommendation, "Combine com itens da mesma categoria."),
      tone: clean(product.kitRecommendation) ? "ready" : "assist"
    },
    {
      label: "Observacao de compra",
      value: friendly(product.purchaseNote, "Para volume maior, fale com o atendimento."),
      tone: clean(product.purchaseNote) ? "review" : "assist"
    }
  ];
}
