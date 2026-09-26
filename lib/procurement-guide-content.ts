import type { GuideArticleInput } from "@/lib/guide-article-input";

export type ProcurementGuideArticle = Omit<GuideArticleInput, "reviewedAt"> & {
  reviewedAt: string;
};

const sharedEditorialDetails = {
  coverImage: "/assets/rosagiro-atacado-hero.webp",
  coverImageAlt: "Caixas e produtos de beleza organizados em prateleiras de estoque.",
  authorName: "Equipe RosaGiro",
  reviewerName: "",
  reviewedAt: "",
  sourceNotes:
    "Critérios editoriais baseados na configuração pública atual de pedido mínimo, embalagem fechada e modalidades de entrega da RosaGiro.",
  active: false
} as const;

export const procurementGuideArticles: readonly ProcurementGuideArticle[] = [
  {
    ...sharedEditorialDetails,
    slug: "como-montar-pedido-misto-atacado",
    title: "Como montar um pedido misto no atacado",
    excerpt: "Organize uma compra para revenda combinando produtos e atingindo o pedido mínimo atual de R$ 500.",
    body:
      "Comece pelo que sua loja precisa repor e agrupe os produtos por categoria, marca ou faixa de preço. Na RosaGiro, o pedido mínimo atual para atacado é de R$ 500,00. Você pode combinar produtos diferentes para chegar a esse valor, desde que cada item respeite a embalagem de venda indicada no catálogo.\n\nAntes de finalizar, confira a quantidade de cada item e o subtotal do carrinho. Usar itens de reposição para completar o valor pode ajudar a montar uma seleção mais equilibrada, mas escolha somente o que faz sentido para seu público e para o espaço disponível na loja.\n\nSe houver dúvida sobre disponibilidade, lote, embalagem ou combinação de itens, envie a lista ao atendimento com sua cidade e UF. Assim, a conferência é feita antes da conclusão do pedido.",
    sortOrder: 10
  },
  {
    ...sharedEditorialDetails,
    slug: "entenda-caixa-fechada-caixa-master-e-minimo-por-item",
    title: "Caixa fechada, caixa master e mínimo por item: como conferir",
    excerpt: "Veja o que cada tipo de embalagem significa e o que confirmar antes de adicionar produtos ao pedido.",
    body:
      "Caixa fechada é a embalagem original de venda do produto. A quantidade e a composição devem ser conferidas na ficha do item ou com o atendimento antes da compra. Não existe uma quantidade universal para todas as caixas: cada produto pode ter embalagem e mínimo próprios.\n\nCaixa master é uma embalagem maior que reúne unidades ou embalagens menores para transporte ou compra em maior volume. Ela não substitui automaticamente a caixa fechada nem define um mínimo único para todo o catálogo. Quando houver essa opção, confirme a quantidade total, a composição e a disponibilidade para o produto escolhido.\n\nA venda por unidade, caixa fechada ou caixa master depende da condição informada para cada item. Em embalagens fechadas, as cores e variações geralmente não podem ser escolhidas separadamente, pois seguem a composição original. Qualquer exceção precisa ser confirmada pelo atendimento antes do fechamento do pedido.",
    sortOrder: 20
  },
  {
    ...sharedEditorialDetails,
    slug: "como-funciona-frete-e-retirada-no-atacado",
    title: "Frete separado e retirada no atacado: como funciona",
    excerpt: "Entenda o pagamento dos produtos no site, a aprovação do frete cobrado fora do site e a retirada combinada.",
    body:
      "O pagamento no site inclui somente os produtos. O frete não está incluído nesse pagamento e não é cobrado pelo site.\n\nDepois da confirmação da lista, o atendimento calcula o frete com base no peso e nas dimensões reais do pacote. O valor é informado para aprovação do comprador e, após essa aprovação, é cobrado separadamente pelo atendimento, fora do site. Se a lista ou o destino mudar, peça uma nova confirmação do frete.\n\nRetirada local não é automática. Ela pode ser combinada com o atendimento quando houver confirmação prévia de disponibilidade, local e horário. Não se desloque para retirar produtos sem essa confirmação.",
    sortOrder: 30
  }
];
