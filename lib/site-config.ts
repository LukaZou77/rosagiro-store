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
    productSecondaryCta: "Tirar dúvida",
    cartCta: "Enviar lista pelo WhatsApp",
    messages: {
      generalGreeting: "Olá, Bela Viva! Quero atendimento para comprar no atacado.",
      generalQuestion: "Sou revendedora/lojista ou quero comprar para reposição. Pode me orientar sobre produtos, estoque, cidade/UF e melhor forma de entrega?",
      productGreeting: "Olá, Bela Viva! Quero consultar este produto.",
      productQuestion: "Pode confirmar estoque, condição para atacado e indicar se compensa retirar, enviar por transportadora ou excursão para minha cidade?",
      cartGreeting: "Olá, Bela Viva! Quero confirmar esta lista de compra.",
      cartQuestion: "Pode revisar estoque, sugerir itens para completar o pedido mínimo e me orientar sobre entrega/retirada para minha cidade?"
    }
  },
  marketplace: "Brasil",
  wholesale: {
    minimumOrderCents: 30000,
    minimumOrderTitle: "Pedido mínimo",
    minimumOrderText: "Pedido mínimo R$ 300,00 para compras no atacado. Se precisar completar a lista, fale com o atendimento.",
    headerStrip: "PEDIDO MÍNIMO R$ 300,00 - OFERTAS MULTIMARCAS - PIX, CEP E WHATSAPP",
    storeTrust: "Dados comerciais, atendimento e políticas reunidos para uma compra mais segura.",
    deliveryModes: [
      "Retirada local mediante confirmação",
      "Anjun D2D Pickup estimado por CEP",
      "Transportadora ou excursão sob consulta"
    ],
    shelfSignals: ["Pedido mínimo R$ 300", "Ofertas e pronta entrega", "Compra para revenda", "WhatsApp rápido"]
  },
  hero: {
    eyebrow: "Atacadão de beleza multimarcas",
    title: "Ofertas para revenda, kits e reposição com compra rápida.",
    body: "Skincare, maquiagem, perfumes, cabelo e acessórios com sinal de estoque, pedido mínimo, frete por CEP e atendimento no WhatsApp.",
    primaryCta: "Comprar pelo catálogo",
    secondaryCta: "Comprar destaque"
  },
  homeSections: {
    categoriesEyebrow: "Categorias",
    categoriesTitle: "Entre rápido na prateleira certa",
    brandsEyebrow: "Multimarcas",
    brandsTitle: "Marcas para combinar em kits, vitrines e reposições.",
    featuredEyebrow: "Pronta entrega",
    featuredTitle: "Produtos com boa saída para testar pedidos"
  },
  homePromotions: {
    promoBar: {
      label: "Ofertas no atacado",
      text: "Pedido mínimo R$ 300,00, Pix, frete por CEP e WhatsApp para revisar estoque e entrega.",
      cta: "Ver ofertas",
      href: "/promocoes"
    },
    searchPlaceholder: "Buscar serum, batom, perfume, pincel...",
    stats: {
      productsLabel: "produtos ativos",
      categoriesLabel: "categorias de beleza",
      brandsLabel: "marcas no catálogo"
    },
    trustPoints: [
      "Pedido mínimo R$ 300,00 sinalizado em toda compra",
      "Pedido multimarcas em um carrinho",
      "Pix e cartão pelo checkout seguro",
      "Frete Anjun estimado por CEP",
      "WhatsApp para dúvidas de estoque e entrega"
    ],
    quickActions: [
      {
        label: "Ofertas",
        description: "Desconto real, pronta entrega e giro rápido para revenda.",
        href: "/promocoes"
      },
      {
        label: "Menor preço",
        description: "Itens com preço comparativo para compras de oportunidade.",
        href: "/categoria/all?sort=price-asc"
      },
      {
        label: "Reposição",
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
      title: "Compra mínima clara, WhatsApp rápido e entrega do jeito brasileiro.",
      body: "A vitrine orienta pedido mínimo, estoque, pronta entrega, Pix, frete por CEP e consulta por WhatsApp para quem compra para revenda ou reposição.",
      primaryCta: "Ver todos os produtos",
      secondaryCta: "Falar no WhatsApp"
    },
    shelfNote: "Confira estoque e combinações pelo WhatsApp antes de fechar pedidos de reposição."
  },
  promotionsPage: {
    eyebrow: "Promoções",
    title: "Ofertas para montar pedido de atacado com agilidade.",
    body: "Uma vitrine direta para encontrar desconto real, itens de menor preço, campeões de giro e produtos com estoque para reposição.",
    primaryCta: "Comprar ofertas",
    secondaryCta: "Falar no WhatsApp",
    heroBadge: "Promocao multimarcas",
    dealShelfTitle: "Descontos reais no catálogo",
    dealShelfBody: "Produtos com preço anterior cadastrado e oportunidade real para repor estoque.",
    emptyDealTitle: "Nenhuma oferta ativa no momento.",
    emptyDealBody: "Novas promoções entram aqui quando houver preço promocional confirmado.",
    emptyStockTitle: "Nenhum produto em pronta entrega.",
    emptyStockBody: "Assim que o estoque for atualizado, os itens de reposição voltam para esta prateleira.",
    lowPriceTitle: "Menor preço para completar pedido",
    hotShelfTitle: "Mais procurados para revenda",
    stockShelfTitle: "Pronta entrega e reposição",
    shelfNote: "Os destaques usam campos atuais do produto: desconto real, badges, estoque, avaliacao, marca e categoria.",
    signals: [
      "Pedido mínimo R$ 300",
      "Desconto real quando existe preço comparativo",
      "Produtos multimarcas para revenda",
      "Pix, CEP e WhatsApp visíveis"
    ],
    tiles: [
      {
        label: "Desconto real",
        text: "Somente itens com preço antigo cadastrado entram como oferta."
      },
      {
        label: "Compra rápida",
        text: "Atalhos por menor preço, giro e estoque para montar carrinho."
      },
      {
        label: "Atacado local",
        text: "Pedido mínimo, retirada, transportadora e excursão continuam visíveis."
      }
    ]
  },
  productConversion: {
    priceLabel: "Preço para pedido",
    discountLabel: "Desconto real",
    minimumLabel: "Mínimo atacado",
    stockLabel: "Estoque",
    freightLabel: "Frete por CEP",
    freightText: "Anjun, retirada ou consulta no WhatsApp",
    cardMinimumHint: "R$ 300 mínimo",
    detailPanelTitle: "Compra no atacado",
    detailPanelNote: "Confira estoque, pedido mínimo e frete antes de finalizar. Para comprar em volume, o atendimento pode sugerir itens para completar sua lista.",
    reviewFallback: "Produto em curadoria",
    bundlePrompt: "Quer montar kit para revenda? Envie este item pelo WhatsApp e informe sua cidade/UF.",
    wholesaleInfoEyebrow: "Compra para revenda",
    wholesaleInfoTitle: "Detalhes para atacado",
    wholesaleInfoNote: "Use estas informações para montar reposição, kit ou caixa. Se for comprar volume maior, confirme validade/lote e entrega pelo WhatsApp.",
    unavailableCta: "Consultar disponibilidade",
    completionEyebrow: "Completar pedido",
    completionTitle: "Combine para fechar pedido mínimo",
    completionBody: "Sugestões com estoque para ajudar a montar uma lista de atacado mais completa.",
    completionReachedTitle: "Produtos para combinar",
    completionReachedBody: "Inclua itens de reposição ou revenda antes de finalizar.",
    completionAddCta: "Adicionar",
    completionAddedCta: "Adicionado",
    galleryRichHint: "Use a galeria para ver embalagem, textura, frente, verso e detalhes antes de montar sua lista.",
    galleryLeanHint: "Consulte fotos do lote, validade e embalagem pelo WhatsApp antes de comprar em volume.",
    fichaTitle: "Ficha do produto",
    fichaBody: "Informações de marca, categoria, tamanho, textura e peso usadas para escolher o item certo.",
    deliveryTitle: "Entrega e atendimento",
    deliveryBody: "A compra combina checkout com suporte humano para estoque, lote, retirada, transportadora ou excursão."
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
        title: "Endereço e frete",
        summary: "CEP, entrega, retirada ou frete por consulta."
      },
      payment: {
        title: "Pagamento",
        summary: "Pix, cartão ou confirmação pelo atendimento."
      }
    },
    validation: {
      name: "Informe seu nome completo para continuar.",
      email: "Informe um e-mail válido.",
      phone: "Informe seu WhatsApp com DDD.",
      cpf: "Informe CPF com 11 dígitos.",
      cep: "Informe um CEP com 8 dígitos.",
      state: "Escolha o estado.",
      city: "Informe a cidade.",
      street: "Informe a rua.",
      number: "Informe o número.",
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
        body: "Ao adicionar produtos ou iniciar o checkout podemos solicitar nome e WhatsApp para atendimento e compra no atacado. No checkout também coletamos e-mail, CPF e endereço para criar o pedido e organizar a entrega."
      },
      {
        title: "Uso das informações",
        body: "Os dados são usados para atendimento via WhatsApp, organização de clientes, processamento de pedidos e validação operacional. A primeira versão não cria senha nem área pública de cliente."
      },
      {
        title: "Ajustes antes do lancamento",
        body: "Este texto deve ser mantido atualizado com os dados reais da empresa, canais de suporte e políticas LGPD aplicáveis."
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
        body: "Produtos, marcas, estoque e preços podem variar. A confirmação final de disponibilidade e entrega pode ser feita pelo atendimento antes da conclusão da compra."
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
    description: "Informações iniciais sobre modalidades de entrega para pedidos no Brasil.",
    sections: [
      {
        title: "Modalidades",
        body: "A loja trabalha com estimativa de frete por CEP no checkout e retirada local mediante confirmação. Transportadora e excursão continuam como opções para consulta pelo WhatsApp."
      },
      {
        title: "Cotacao por CEP",
        body: "A primeira regra usa tabela Anjun D2D Pickup importada no admin, com origem São Paulo e cálculo por CEP e peso. Seguro, impostos e áreas especiais podem exigir confirmação manual."
      },
      {
        title: "Integrações futuras",
        body: "A loja pode evoluir para novas integracoes de transporte sem alterar a experiencia principal de checkout e atendimento."
      }
    ]
  },
  contact: {
    slug: "contato",
    href: "/contato",
    eyebrow: "Atendimento",
    title: "Contato",
    description: "Canais para atendimento, dúvidas sobre estoque, pedidos e compras no atacado.",
    sections: [
      {
        title: "E-mail",
        body: "Use o e-mail informado pela loja para suporte, dúvidas de pedido e contato comercial."
      },
      {
        title: "WhatsApp",
        body: "O WhatsApp é o canal principal para confirmar estoque, montar lista de compra, combinar retirada ou tirar dúvidas de entrega."
      },
      {
        title: "Compra no atacado",
        body: "Informe sua cidade/UF e se a compra é para revenda, reposição ou uso profissional para receber uma orientação mais rápida."
      }
    ]
  }
} satisfies Record<string, InfoPageContent>;

export const allInfoPages = Object.values(infoPages);

export function siteUrl(path = "") {
  const base = process.env.NEXT_PUBLIC_SITE_URL || siteConfig.defaultUrl;
  return new URL(path, base).toString();
}
