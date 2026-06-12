export type ProductDetailTone = "ready" | "review" | "assist";

export type ProductDetailServiceCard = {
  label: string;
  value: string;
  tone: ProductDetailTone;
};

export function productDetailGalleryState(gallery: string[]) {
  const count = gallery.filter(Boolean).length;
  return {
    count,
    isRich: count >= 3,
    label: count > 1 ? `${count} fotos para conferir detalhes` : "Clique na foto para ampliar"
  };
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
