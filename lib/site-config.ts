const whatsappPhone = "5511970792390";

export const siteConfig = {
  name: "RosaGiro",
  tagline: "Atacado de cosméticos em São Paulo",
  description: "RosaGiro, atacado de cosméticos em São Paulo para revenda no Brasil.",
  defaultUrl: "http://localhost:3000",
  supportEmail: "rosagiroatacado@gmail.com",
  brandAssets: {
    avatar: "/brand/rosagiro-avatar.png",
    headerImage: "/brand/rosagiro-logo-header.png",
    icon64: "/brand/rosagiro-icon-64.png",
    icon180: "/brand/rosagiro-icon-180.png",
    icon512: "/brand/rosagiro-icon-512.png",
    ogImage: "/brand/rosagiro-og.png"
  },
  whatsapp: {
    phone: whatsappPhone,
    displayNumber: "+55 11 97079-2390",
    baseHref: `https://wa.me/${whatsappPhone}`,
    label: "WhatsApp",
    serviceLabel: "Atendimento WhatsApp",
    productCta: "Consultar no WhatsApp",
    productSecondaryCta: "Tirar dúvida",
    cartCta: "Enviar lista pelo WhatsApp",
    messages: {
      generalGreeting: "Olá, RosaGiro! Quero atendimento para comprar no atacado.",
      generalQuestion: "Sou revendedora/lojista ou quero comprar para reposição. Pode me orientar sobre produtos, estoque, cidade/UF e cotação de entrega para todo o Brasil?",
      productGreeting: "Olá, RosaGiro! Quero consultar este produto.",
      productQuestion: "Pode confirmar estoque, condição para atacado e indicar a melhor opção de entrega nacional, retirada, transportadora ou excursão?",
      cartGreeting: "Olá, RosaGiro! Quero confirmar esta lista de compra.",
      cartQuestion: "Pode revisar estoque, sugerir itens para completar o pedido mínimo e me orientar sobre entrega para todo o Brasil, retirada ou excursão?"
    }
  },
  marketplace: "Brasil",
  wholesale: {
    minimumOrderCents: 30000,
    minimumOrderTitle: "Pedido mínimo",
    minimumOrderText: "Pedido mínimo R$ 300,00 para compras no atacado. Se precisar completar a lista, fale com o atendimento.",
    headerStrip: "PEDIDO MÍNIMO R$ 300,00 - ENTREGA PARA TODO O BRASIL - PIX E WHATSAPP",
    storeTrust: "Dados comerciais, atendimento e políticas reunidos para uma compra mais segura.",
    nationalDeliveryLabel: "Entrega para todo o Brasil",
    nationalDeliveryText: "Enviamos para todo o Brasil com cotação por CEP.",
    nationalDeliveryNote: "Algumas regiões podem exigir confirmação de cobertura, prazo, seguro ou taxa adicional pelo WhatsApp.",
    deliveryModes: [
      "Entrega para todo o Brasil com cotação por CEP",
      "Retirada local mediante confirmação",
      "Anjun, transportadora ou excursão sob consulta"
    ],
    shelfSignals: ["Pedido mínimo R$ 300", "Entrega para todo o Brasil", "Compra para revenda", "WhatsApp rápido"]
  },
  hero: {
    eyebrow: "Atacado de cosméticos em São Paulo",
    title: "Ofertas para revenda, kits e reposição com compra rápida.",
    body: "Skincare, maquiagem, perfumes, cabelo e acessórios com disponibilidade sinalizada, pedido mínimo, cotação por CEP para todo o Brasil e atendimento no WhatsApp.",
    primaryCta: "Comprar pelo catálogo",
    secondaryCta: "Comprar destaque"
  },
  homeSections: {
    categoriesEyebrow: "Categorias",
    categoriesTitle: "Entre rápido na prateleira certa",
    brandsEyebrow: "Multimarcas",
    brandsTitle: "Marcas para combinar em kits, vitrines e reposições.",
    featuredEyebrow: "Em estoque",
    featuredTitle: "Produtos com boa saída para testar pedidos"
  },
  homePromotions: {
    promoBar: {
      label: "Ofertas no atacado",
      text: "Pedido mínimo R$ 300,00, Pix, entrega para todo o Brasil com cotação por CEP e WhatsApp para revisar estoque.",
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
      "Entrega para todo o Brasil com cotação por CEP",
      "WhatsApp para dúvidas de estoque e entrega"
    ],
    quickActions: [
      {
        label: "Ofertas",
        description: "Desconto real, disponibilidade e oportunidades para revenda.",
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
      title: "Compra mínima clara, WhatsApp rápido e entrega para todo o Brasil.",
      body: "A vitrine orienta pedido mínimo, disponibilidade, Pix, cotação por CEP para todo o Brasil e consulta por WhatsApp para quem compra para revenda ou reposição.",
      primaryCta: "Ver todos os produtos",
      secondaryCta: "Falar no WhatsApp"
    },
    shelfNote: "Confira estoque e combinações pelo WhatsApp antes de fechar pedidos de reposição."
  },
  promotionsPage: {
    eyebrow: "Promoções",
    title: "Ofertas para montar pedido de atacado com agilidade.",
    body: "Uma vitrine direta para encontrar desconto real, itens de menor preço, campeões de venda e produtos em estoque para reposição.",
    primaryCta: "Comprar ofertas",
    secondaryCta: "Falar no WhatsApp",
    heroBadge: "Promoção multimarcas",
    dealShelfTitle: "Descontos reais no catálogo",
    dealShelfBody: "Produtos com preço anterior cadastrado e oportunidade real para repor estoque.",
    emptyDealTitle: "Nenhuma oferta ativa no momento.",
    emptyDealBody: "Novas promoções entram aqui quando houver preço promocional confirmado.",
    emptyStockTitle: "Nenhum produto em estoque.",
    emptyStockBody: "Assim que o estoque for atualizado, os itens de reposição voltam para esta prateleira.",
    lowPriceTitle: "Menor preço para completar pedido",
    hotShelfTitle: "Mais procurados para revenda",
    stockShelfTitle: "Em estoque para reposição",
    shelfNote: "Os destaques usam campos atuais do produto: desconto real, tags, estoque, avaliação, marca e categoria.",
    signals: [
      "Pedido mínimo R$ 300",
      "Desconto real quando existe preço comparativo",
      "Produtos multimarcas para revenda",
      "Entrega para todo o Brasil",
      "Pix, CEP e WhatsApp visíveis"
    ],
    tiles: [
      {
        label: "Desconto real",
        text: "Somente itens com preço antigo cadastrado entram como oferta."
      },
      {
        label: "Compra rápida",
        text: "Atalhos por menor preço, disponibilidade e oportunidade para montar carrinho."
      },
      {
        label: "Atacado local",
        text: "Pedido mínimo, cotação nacional por CEP, retirada, transportadora e excursão continuam visíveis."
      }
    ]
  },
  productConversion: {
    priceLabel: "Preço para pedido",
    discountLabel: "Desconto real",
    minimumLabel: "Pedido mínimo",
    minimumNote: "Pode combinar produtos diferentes no mesmo pedido.",
    stockLabel: "Disponibilidade",
    freightLabel: "Entrega",
    freightText: "Frete nacional por CEP",
    cardMinimumHint: "R$ 300 mínimo",
    detailPanelTitle: "Compra no atacado",
    detailPanelNote: "Antes de finalizar, você pode confirmar lote, validade, frete ou volume maior pelo WhatsApp.",
    bundlePrompt: "Quer comprar em volume? Envie este item pelo WhatsApp e informe sua cidade/UF.",
    wholesaleInfoEyebrow: "Compra para revenda",
    wholesaleInfoTitle: "Detalhes para atacado",
    wholesaleInfoNote: "Use estas informações para conferir caixa, lote e condição de atacado. Se for comprar volume maior, confirme validade/lote e cotação de entrega nacional pelo WhatsApp.",
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
    deliveryTitle: "Entrega e atendimento",
    deliveryBody: "A compra combina checkout com suporte humano para estoque, lote, entrega para todo o Brasil, retirada, transportadora ou excursão."
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
    mobile: {
      editingLabel: "Preenchendo dados"
    },
    steps: {
      contact: {
        title: "Contato",
        summary: "Nome, e-mail, CPF e WhatsApp para atendimento."
      },
      address: {
        title: "Endereço e frete",
        summary: "CEP, entrega nacional, retirada ou frete por consulta."
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
  { href: "/trocas-e-devolucoes", label: "Trocas e devoluções" },
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
    eyebrow: "Política",
    title: "Política de privacidade",
    description: "Resumo editável sobre como a RosaGiro trata dados de contato, entrega e pedidos.",
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
    description: "Condições iniciais para navegação, pedidos e uso da loja RosaGiro.",
    sections: [
      {
        title: "Uso da loja",
        body: "A RosaGiro organiza produtos multimarcas de beleza para compras no atacado, reposição e revenda, com atendimento de apoio pelo WhatsApp."
      },
      {
        title: "Catálogo e preços",
        body: "Produtos, marcas, estoque e preços podem variar. A confirmação final de disponibilidade e entrega pode ser feita pelo atendimento antes da conclusão da compra."
      },
      {
        title: "Contato",
        body: "Dúvidas comerciais, suporte e solicitações devem usar os canais oficiais exibidos na página de contato."
      }
    ]
  },
  returns: {
    slug: "trocas-e-devolucoes",
    href: "/trocas-e-devolucoes",
    eyebrow: "Pós-compra",
    title: "Trocas e devoluções",
    description: "Base editável para uma política clara de troca, arrependimento e produtos avariados.",
    sections: [
      {
        title: "Prazo de arrependimento",
        body: "Reserve este bloco para a regra final de arrependimento em compras online, incluindo prazos, canais e condições do produto."
      },
      {
        title: "Produto com avaria",
        body: "Oriente o cliente a guardar embalagem, nota e fotos do item. A regra final deve definir como o atendimento aprova troca ou reembolso."
      },
      {
        title: "Itens de beleza",
        body: "Por higiene e segurança, produtos abertos podem ter condições específicas. Ajuste esta política antes de operar vendas reais."
      }
    ]
  },
  shipping: {
    slug: "entrega",
    href: "/entrega",
    eyebrow: "Entrega",
    title: "Entrega e frete",
    description: "Informações iniciais sobre entrega nacional e modalidades de frete para pedidos no Brasil.",
    sections: [
      {
        title: "Modalidades",
        body: "Enviamos para todo o Brasil com cotação por CEP no checkout. Retirada local, transportadora e excursão continuam como opções de consulta pelo WhatsApp."
      },
      {
        title: "Cotação por CEP",
        body: "A primeira regra usa tabela Anjun D2D Pickup importada no admin, com origem São Paulo e cálculo por CEP e peso. Seguro, impostos e áreas especiais podem exigir confirmação manual."
      },
      {
        title: "Integrações futuras",
        body: "Algumas regiões podem exigir confirmação de cobertura, prazo, seguro, imposto ou taxa adicional pelo WhatsApp antes do envio."
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
        body: "Use rosagiroatacado@gmail.com para suporte, dúvidas de pedido e contato comercial."
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
