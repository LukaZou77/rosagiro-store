import type { GuideArticleInput } from "@/lib/guide-article-input";

export type ProcurementGuideArticle = Omit<GuideArticleInput, "reviewedAt"> & {
  reviewedAt: string;
};

const sharedEditorialDetails = {
  coverImage: "/assets/rosagiro-atacado-hero.webp",
  coverImageAlt: "Caixas e produtos de beleza organizados em prateleiras de estoque.",
  authorName: "Equipe RosaGiro",
  reviewerName: "RosaGiro",
  reviewedAt: "2026-09-26",
  sourceNotes:
    "Configuração vigente da RosaGiro conferida em 26/09/2026: pedido mínimo, embalagem fechada, frete separado e retirada agendada.",
  active: true
} as const;

export const procurementGuideArticles: readonly ProcurementGuideArticle[] = [
  {
    ...sharedEditorialDetails,
    slug: "como-montar-pedido-misto-atacado",
    title: "Como montar um pedido misto no atacado",
    excerpt: "Combine produtos e marcas no mesmo carrinho para alcançar o pedido mínimo de R$ 500 em mercadorias.",
    body:
      "Na RosaGiro, o pedido mínimo atual para compras no atacado é de R$ 500,00 em produtos. Você pode combinar categorias, itens e marcas diferentes no mesmo carrinho para alcançar esse valor. O frete não entra nesse mínimo nem no total pago pelo site.\n\nComece pelos produtos que sua loja precisa repor e distribua o orçamento entre itens de giro, novidades e complementos. Cada produto deve respeitar a embalagem fechada e a quantidade indicadas em sua própria ficha; o pedido misto não transforma uma caixa em venda avulsa.\n\nAntes de finalizar, confira o subtotal dos produtos, a quantidade de cada embalagem e os dados de entrega. Se precisar confirmar estoque, lote, validade ou composição de uma embalagem, fale com o atendimento e informe sua cidade e UF.",
    sortOrder: 10
  },
  {
    ...sharedEditorialDetails,
    slug: "entenda-caixa-fechada-caixa-master-e-minimo-por-item",
    title: "Caixa fechada, caixa master e mínimo por item: como conferir",
    excerpt: "Entenda como conferir a embalagem de venda e por que caixa fechada e caixa master não têm uma quantidade universal.",
    body:
      "Caixa fechada é a embalagem de venda indicada para um produto. A quantidade, a composição e as possíveis variações devem ser conferidas na ficha do item. Não existe uma quantidade universal: cada produto pode ter uma embalagem própria.\n\nCaixa master é uma embalagem maior, normalmente usada para reunir unidades ou caixas menores. Esse termo só vale quando estiver informado para o produto ou confirmado pelo atendimento. Uma caixa master não substitui automaticamente a caixa fechada e também não define um mínimo único para todo o catálogo.\n\nAntes de comprar, confira qual embalagem aparece na ficha e quantas unidades ela contém. Nas embalagens fechadas, cores e variações seguem a composição original e não podem ser escolhidas separadamente. Se a ficha não deixar clara a quantidade ou mencionar caixa master, confirme a composição exata com o atendimento antes de finalizar.",
    sortOrder: 20
  },
  {
    ...sharedEditorialDetails,
    slug: "como-funciona-frete-e-retirada-no-atacado",
    title: "Frete separado e retirada no atacado: como funciona",
    excerpt: "Veja como o frete é cotado e pago após sua aprovação e como agendar retirada na LA BELLA.",
    body:
      "O pagamento feito no site inclui somente os produtos. O frete não está incluído nesse pagamento e não é cobrado pelo site.\n\nApós a compra, a equipe calcula o frete com base no peso e nas dimensões reais do pacote. O atendimento informa o valor para sua aprovação e só depois dessa aprovação faz a cobrança separada, fora do site. Se os produtos ou o destino mudarem, a cotação precisa ser confirmada novamente.\n\nA retirada pode ser feita na LA BELLA, Rua Paula Sousa, 529, Box A01, São Paulo - SP, somente com agendamento e confirmação pelo WhatsApp. Aguarde a confirmação de que o pedido está pronto e do horário combinado antes de ir ao local.",
    sortOrder: 30
  }
];
