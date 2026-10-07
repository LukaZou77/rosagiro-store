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

export function productDetailPurchaseNotice({
  consultationOnly,
  packagePieces,
  packagePriceCents
}: {
  consultationOnly: boolean;
  packagePieces: number | null;
  packagePriceCents: number | null;
}) {
  if (!consultationOnly) {
    return {
      title: "Embalagem fechada do fabricante",
      description: "As cores e variações vêm na composição original da embalagem. Não é possível escolher cores nem fracionar unidades."
    };
  }

  if (!packagePieces || packagePieces <= 0) {
    return {
      title: "Condição de compra sob consulta",
      description: "Confirme estoque, unidade de venda e composição da embalagem pelo WhatsApp antes do pedido."
    };
  }

  return {
    title: `Embalagem fechada com ${packagePieces} ${packagePieces === 1 ? "unidade" : "unidades"}`,
    description: packagePriceCents && packagePriceCents > 0
      ? "Confirme a disponibilidade em estoque pelo WhatsApp antes do pedido."
      : "Confirme o valor total da embalagem e a disponibilidade em estoque pelo WhatsApp antes do pedido."
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
      value: "O site recebe o valor dos produtos. O frete é aprovado e cobrado separadamente pelo atendimento.",
      tone: "assist"
    }
  ];
}
