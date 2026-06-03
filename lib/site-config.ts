const whatsappPhone = "5511900000000";

export const siteConfig = {
  name: "Bela Viva",
  tagline: "beleza multimarcas",
  description: "Bela Viva, ecommerce multimarcas de beleza para o Brasil.",
  defaultUrl: "http://localhost:3000",
  supportEmail: "contato@belaviva.local",
  whatsapp: {
    phone: whatsappPhone,
    displayNumber: "+55 11 90000-0000",
    baseHref: `https://wa.me/${whatsappPhone}`,
    label: "WhatsApp",
    serviceLabel: "Atendimento WhatsApp",
    productCta: "Consultar no WhatsApp",
    productSecondaryCta: "Tirar duvida",
    cartCta: "Enviar lista pelo WhatsApp",
    messages: {
      generalGreeting: "Ola, Bela Viva! Quero atendimento para comprar no atacado.",
      generalQuestion: "Sou revendedora/lojista ou quero comprar para reposicao. Pode me orientar sobre produtos, estoque, cidade/UF e melhor forma de entrega?",
      productGreeting: "Ola, Bela Viva! Quero consultar este produto.",
      productQuestion: "Pode confirmar estoque, condicao para atacado e indicar se compensa retirar, enviar por transportadora ou excursao para minha cidade?",
      cartGreeting: "Ola, Bela Viva! Quero confirmar esta lista de compra.",
      cartQuestion: "Pode revisar estoque, sugerir itens para completar o pedido minimo e me orientar sobre entrega/retirada para minha cidade?"
    }
  },
  marketplace: "Brasil",
  wholesale: {
    minimumOrderCents: 30000,
    minimumOrderTitle: "Pedido minimo",
    minimumOrderText: "Pedido minimo R$ 300,00 para compras no atacado. Se precisar completar a lista, fale com o atendimento.",
    headerStrip: "PEDIDO MINIMO R$ 300,00 - OFERTAS MULTIMARCAS - PIX, CEP E WHATSAPP",
    storeTrust: "Dados comerciais, atendimento e politicas reunidos para uma compra mais segura.",
    deliveryModes: [
      "Retirada local mediante confirmacao",
      "Anjun D2D Pickup estimado por CEP",
      "Transportadora ou excursao sob consulta"
    ],
    shelfSignals: ["Pedido minimo R$ 300", "Ofertas e pronta entrega", "Compra para revenda", "WhatsApp rapido"]
  },
  hero: {
    eyebrow: "Atacadao de beleza multimarcas",
    title: "Ofertas para revenda, kits e reposicao com compra rapida.",
    body: "Skincare, maquiagem, perfumes, cabelo e acessorios com sinal de estoque, pedido minimo, frete por CEP e atendimento no WhatsApp.",
    primaryCta: "Comprar pelo catalogo",
    secondaryCta: "Comprar destaque"
  },
  homeSections: {
    categoriesEyebrow: "Categorias",
    categoriesTitle: "Entre rapido na prateleira certa",
    brandsEyebrow: "Multimarcas",
    brandsTitle: "Marcas para combinar em kits, vitrines e reposicoes.",
    featuredEyebrow: "Pronta entrega",
    featuredTitle: "Produtos com boa saida para testar pedidos"
  },
  homePromotions: {
    promoBar: {
      label: "Ofertas no atacado",
      text: "Pedido minimo R$ 300,00, Pix, frete por CEP e WhatsApp para revisar estoque e entrega.",
      cta: "Ver ofertas",
      href: "/promocoes"
    },
    searchPlaceholder: "Buscar serum, batom, perfume, pincel...",
    stats: {
      productsLabel: "produtos ativos",
      categoriesLabel: "categorias de beleza",
      brandsLabel: "marcas no catalogo"
    },
    trustPoints: [
      "Pedido minimo R$ 300,00 sinalizado em toda compra",
      "Pedido multimarcas em um carrinho",
      "Pix e cartao pelo checkout seguro",
      "Frete Anjun estimado por CEP",
      "WhatsApp para duvidas de estoque e entrega"
    ],
    quickActions: [
      {
        label: "Ofertas",
        description: "Desconto real, pronta entrega e giro rapido para revenda.",
        href: "/promocoes"
      },
      {
        label: "Menor preco",
        description: "Itens com preco comparativo para compras de oportunidade.",
        href: "/categoria/all?sort=price-asc"
      },
      {
        label: "Reposicao",
        description: "Skincare, make e corpo para completar prateleira.",
        href: "/categoria/all"
      },
      {
        label: "Revenda",
        description: "Combine produtos por rotina, marca e categoria.",
        href: "/categoria/skincare"
      }
    ],
    wholesaleBand: {
      eyebrow: "Compra com volume",
      title: "Compra minima clara, WhatsApp rapido e entrega do jeito brasileiro.",
      body: "A vitrine orienta pedido minimo, estoque, pronta entrega, Pix, frete por CEP e consulta por WhatsApp para quem compra para revenda ou reposicao.",
      primaryCta: "Ver todos os produtos",
      secondaryCta: "Falar no WhatsApp"
    },
    shelfNote: "Confira estoque e combinacoes pelo WhatsApp antes de fechar pedidos de reposicao."
  },
  promotionsPage: {
    eyebrow: "Promocoes",
    title: "Ofertas para montar pedido de atacado com agilidade.",
    body: "Uma vitrine direta para encontrar desconto real, itens de menor preco, campeoes de giro e produtos com estoque para reposicao.",
    primaryCta: "Comprar ofertas",
    secondaryCta: "Falar no WhatsApp",
    heroBadge: "Promocao multimarcas",
    dealShelfTitle: "Descontos reais no catalogo",
    dealShelfBody: "Produtos com preco anterior cadastrado e oportunidade real para repor estoque.",
    emptyDealTitle: "Nenhuma oferta ativa no momento.",
    emptyDealBody: "Novas promocoes entram aqui quando houver preco promocional confirmado.",
    emptyStockTitle: "Nenhum produto em pronta entrega.",
    emptyStockBody: "Assim que o estoque for atualizado, os itens de reposicao voltam para esta prateleira.",
    lowPriceTitle: "Menor preco para completar pedido",
    hotShelfTitle: "Mais procurados para revenda",
    stockShelfTitle: "Pronta entrega e reposicao",
    shelfNote: "Os destaques usam campos atuais do produto: desconto real, badges, estoque, avaliacao, marca e categoria.",
    signals: [
      "Pedido minimo R$ 300",
      "Desconto real quando existe preco comparativo",
      "Produtos multimarcas para revenda",
      "Pix, CEP e WhatsApp visiveis"
    ],
    tiles: [
      {
        label: "Desconto real",
        text: "Somente itens com preco antigo cadastrado entram como oferta."
      },
      {
        label: "Compra rapida",
        text: "Atalhos por menor preco, giro e estoque para montar carrinho."
      },
      {
        label: "Atacado local",
        text: "Pedido minimo, retirada, transportadora e excursao continuam visiveis."
      }
    ]
  },
  productConversion: {
    priceLabel: "Preco para pedido",
    discountLabel: "Desconto real",
    minimumLabel: "Minimo atacado",
    stockLabel: "Estoque",
    freightLabel: "Frete por CEP",
    freightText: "Anjun, retirada ou consulta no WhatsApp",
    cardMinimumHint: "R$ 300 minimo",
    detailPanelTitle: "Compra no atacado",
    detailPanelNote: "Confira estoque, pedido minimo e frete antes de finalizar. Para comprar em volume, o atendimento pode sugerir itens para completar sua lista.",
    reviewFallback: "Produto em curadoria",
    bundlePrompt: "Quer montar kit para revenda? Envie este item pelo WhatsApp e informe sua cidade/UF.",
    wholesaleInfoEyebrow: "Compra para revenda",
    wholesaleInfoTitle: "Detalhes para atacado",
    wholesaleInfoNote: "Use estas informacoes para montar reposicao, kit ou caixa. Se for comprar volume maior, confirme validade/lote e entrega pelo WhatsApp.",
    unavailableCta: "Consultar disponibilidade",
    completionEyebrow: "Completar pedido",
    completionTitle: "Combine para fechar pedido minimo",
    completionBody: "Sugestoes com estoque para ajudar a montar uma lista de atacado mais completa.",
    completionReachedTitle: "Produtos para combinar",
    completionReachedBody: "Inclua itens de reposicao ou revenda antes de finalizar.",
    completionAddCta: "Adicionar",
    completionAddedCta: "Adicionado",
    galleryRichHint: "Use a galeria para ver embalagem, textura, frente, verso e detalhes antes de montar sua lista.",
    galleryLeanHint: "Foto principal cadastrada. Para comprar em quantidade, solicite fotos extras e detalhes do lote pelo WhatsApp.",
    fichaTitle: "Ficha do produto",
    fichaBody: "Informacoes de marca, categoria, tamanho, textura e peso usadas para escolher o item certo.",
    deliveryTitle: "Entrega e atendimento",
    deliveryBody: "A compra combina checkout com suporte humano para estoque, lote, retirada, transportadora ou excursao."
  },
  mobilePurchase: {
    filterTitle: "Filtrar e ordenar",
    filterHint: "Ajuste busca, marca e prioridade.",
    productCta: "Comprar",
    productWhatsAppCta: "WhatsApp",
    checkoutBarLabel: "Total do pedido",
    checkoutSubmit: "Finalizar"
  },
  checkout: {
    stepperLabel: "Etapas do checkout",
    completedLabel: "Completo",
    editCta: "Editar",
    nextCta: "Continuar",
    backCta: "Voltar",
    finalCta: "Finalizar pedido",
    steps: {
      contact: {
        title: "Contato",
        summary: "Nome, e-mail, CPF e WhatsApp para atendimento."
      },
      address: {
        title: "Endereco e frete",
        summary: "CEP, entrega, retirada ou frete por consulta."
      },
      payment: {
        title: "Pagamento",
        summary: "Pix, cartao ou confirmacao pelo atendimento."
      }
    },
    validation: {
      name: "Informe seu nome completo para continuar.",
      email: "Informe um e-mail valido.",
      phone: "Informe seu WhatsApp com DDD.",
      cpf: "Informe CPF com 11 digitos.",
      cep: "Informe um CEP com 8 digitos.",
      state: "Escolha o estado.",
      city: "Informe a cidade.",
      street: "Informe a rua.",
      number: "Informe o numero.",
      district: "Informe o bairro.",
      payment: "Escolha uma forma de pagamento."
    }
  }
};

export const storefrontLinks = [
  { href: "/categoria/all", label: "Categorias" },
  { href: "/promocoes", label: "Ofertas" },
  { href: "/entrega", label: "Entrega" },
  { href: "/trocas-e-devolucoes", label: "Trocas" },
  { href: "/contato", label: "Contato" }
];

export const legalLinks = [
  { href: "/politica-de-privacidade", label: "Privacidade" },
  { href: "/termos-de-uso", label: "Termos" },
  { href: "/trocas-e-devolucoes", label: "Trocas e devolucoes" },
  { href: "/entrega", label: "Entrega" }
];

export type InfoPageContent = {
  slug: string;
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  sections: { title: string; body: string }[];
};

export const infoPages = {
  privacy: {
    slug: "politica-de-privacidade",
    href: "/politica-de-privacidade",
    eyebrow: "Politica",
    title: "Politica de privacidade",
    description: "Resumo editavel sobre como a Bela Viva trata dados de contato, entrega e pedidos.",
    sections: [
      {
        title: "Dados coletados",
        body: "Ao adicionar produtos ou iniciar o checkout podemos solicitar nome e WhatsApp para atendimento e compra no atacado. No checkout tambem coletamos e-mail, CPF e endereco para criar o pedido e organizar a entrega."
      },
      {
        title: "Uso das informacoes",
        body: "Os dados sao usados para atendimento via WhatsApp, organizacao de clientes, processamento de pedidos e validacao operacional. A primeira versao nao cria senha nem area publica de cliente."
      },
      {
        title: "Ajustes antes do lancamento",
        body: "Este texto deve ser mantido atualizado com os dados reais da empresa, canais de suporte e politicas LGPD aplicaveis."
      }
    ]
  },
  terms: {
    slug: "termos-de-uso",
    href: "/termos-de-uso",
    eyebrow: "Termos",
    title: "Termos de uso",
    description: "Condicoes iniciais para navegacao, pedidos e uso da loja Bela Viva.",
    sections: [
      {
        title: "Uso da loja",
        body: "A Bela Viva organiza produtos multimarcas de beleza para compras no atacado, reposicao e revenda, com atendimento de apoio pelo WhatsApp."
      },
      {
        title: "Catalogo e precos",
        body: "Produtos, marcas, estoque e precos podem variar. A confirmacao final de disponibilidade e entrega pode ser feita pelo atendimento antes da conclusao da compra."
      },
      {
        title: "Contato",
        body: "Duvidas comerciais, suporte e solicitacoes devem usar os canais oficiais exibidos na pagina de contato."
      }
    ]
  },
  returns: {
    slug: "trocas-e-devolucoes",
    href: "/trocas-e-devolucoes",
    eyebrow: "Pos-compra",
    title: "Trocas e devolucoes",
    description: "Base editavel para uma politica clara de troca, arrependimento e produtos avariados.",
    sections: [
      {
        title: "Prazo de arrependimento",
        body: "Reserve este bloco para a regra final de arrependimento em compras online, incluindo prazos, canais e condicoes do produto."
      },
      {
        title: "Produto com avaria",
        body: "Oriente o cliente a guardar embalagem, nota e fotos do item. A regra final deve definir como o atendimento aprova troca ou reembolso."
      },
      {
        title: "Itens de beleza",
        body: "Por higiene e seguranca, produtos abertos podem ter condicoes especificas. Ajuste esta politica antes de operar vendas reais."
      }
    ]
  },
  shipping: {
    slug: "entrega",
    href: "/entrega",
    eyebrow: "Entrega",
    title: "Entrega e frete",
    description: "Informacoes iniciais sobre modalidades de entrega para pedidos no Brasil.",
    sections: [
      {
        title: "Modalidades",
        body: "A loja trabalha com estimativa de frete por CEP no checkout e retirada local mediante confirmacao. Transportadora e excursao continuam como opcoes para consulta pelo WhatsApp."
      },
      {
        title: "Cotacao por CEP",
        body: "A primeira regra usa tabela Anjun D2D Pickup importada no admin, com origem Sao Paulo e calculo por CEP e peso. Seguro, impostos e areas especiais podem exigir confirmacao manual."
      },
      {
        title: "Integracoes futuras",
        body: "A loja pode evoluir para novas integracoes de transporte sem alterar a experiencia principal de checkout e atendimento."
      }
    ]
  },
  contact: {
    slug: "contato",
    href: "/contato",
    eyebrow: "Atendimento",
    title: "Contato",
    description: "Canais para atendimento, duvidas sobre estoque, pedidos e compras no atacado.",
    sections: [
      {
        title: "E-mail",
        body: "Use o e-mail informado pela loja para suporte, duvidas de pedido e contato comercial."
      },
      {
        title: "WhatsApp",
        body: "O WhatsApp e o canal principal para confirmar estoque, montar lista de compra, combinar retirada ou tirar duvidas de entrega."
      },
      {
        title: "Compra no atacado",
        body: "Informe sua cidade/UF e se a compra e para revenda, reposicao ou uso profissional para receber uma orientacao mais rapida."
      }
    ]
  }
} satisfies Record<string, InfoPageContent>;

export const allInfoPages = Object.values(infoPages);

export function siteUrl(path = "") {
  const base = process.env.NEXT_PUBLIC_SITE_URL || siteConfig.defaultUrl;
  return new URL(path, base).toString();
}
