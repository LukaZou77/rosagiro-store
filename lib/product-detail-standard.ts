import type { CatalogProduct } from "@/lib/catalog";

export type ProductDetailTone = "ready" | "review" | "assist";

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
    label: count > 1 ? `${count} fotos para conferir detalhes` : "Clique na foto para ampliar"
  };
}

export function productDetailInfoItems(product: CatalogProduct): ProductDetailInfoItem[] {
  return [
    { label: "Marca", value: product.brand.name },
    { label: "Categoria", value: product.category.label },
    { label: "Linha", value: product.subcategory },
    { label: "Volume / tamanho", value: friendly(product.volume) },
    { label: "Tipo / uso", value: friendly(product.skinType) },
    { label: "Acabamento / textura", value: friendly(product.finish) },
    { label: "Peso para frete", value: product.weightGrams > 0 ? `${product.weightGrams} g` : "Confirmar no atendimento" }
  ];
}

export function productDetailServiceCards(): ProductDetailServiceCard[] {
  return [
    {
      label: "Frete por CEP",
      value: "Cotação por CEP para todo o Brasil; cobertura e taxas podem ser confirmadas pelo WhatsApp.",
      tone: "ready"
    },
    {
      label: "Retirada / excursão",
      value: "Combine retirada, transportadora ou excursão conforme sua cidade/UF.",
      tone: "ready"
    },
    {
      label: "WhatsApp",
      value: "Atendimento para confirmar entrega, volume e melhor forma de fechar a lista.",
      tone: "ready"
    },
    {
      label: "Checkout",
      value: "Preço, estoque e frete são conferidos antes de finalizar o pedido.",
      tone: "assist"
    }
  ];
}
