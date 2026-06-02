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
      generalQuestion: "Pode me orientar sobre produtos, estoque e formas de entrega?",
      productGreeting: "Ola, Bela Viva! Quero consultar este produto.",
      productQuestion: "Pode confirmar estoque, condicao para atacado e melhor forma de entrega?",
      cartGreeting: "Ola, Bela Viva! Quero confirmar esta lista de compra.",
      cartQuestion: "Pode revisar estoque e me orientar sobre retirada, transportadora ou excursao?"
    }
  },
  marketplace: "Brasil",
  wholesale: {
    minimumOrderCents: 30000,
    minimumOrderTitle: "Pedido minimo",
    minimumOrderText: "Pedido minimo R$ 300,00 para compras no atacado. Nesta fase o pedido de teste nao sera bloqueado.",
    headerStrip: "PEDIDO MINIMO R$ 300,00 - OFERTAS MULTIMARCAS - PIX, CEP E WHATSAPP",
    storeTrust: "CNPJ e dados da loja serao revisados antes da publicacao oficial.",
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
      text: "Pedido minimo R$ 300,00, Pix sandbox, frete por CEP e WhatsApp para revisar estoque e entrega.",
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
      "Pix, cartao e simulador em ambiente de teste",
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
      body: "A vitrine ja orienta pedido minimo, estoque, pronta entrega, Pix sandbox, frete por CEP e consulta por WhatsApp. Depois podemos adicionar preco por quantidade, cupons e tabelas de atacado sem refazer a experiencia.",
      primaryCta: "Ver todos os produtos",
      secondaryCta: "Falar no WhatsApp"
    },
    shelfNote: "Use a importacao CSV para trocar nomes, precos, estoque e descricao quando os produtos reais chegarem."
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
    description: "Resumo editavel sobre como a Bela Viva pretende tratar dados de contato, entrega e pedidos.",
    sections: [
      {
        title: "Dados coletados",
        body: "No checkout coletamos nome, e-mail, telefone, CPF e endereco para criar o pedido e simular a entrega. Esta versao ainda nao cria conta de cliente."
      },
      {
        title: "Uso das informacoes",
        body: "Os dados sao usados para processar pedidos, atendimento e validacao operacional. Integracoes reais de pagamento serao documentadas antes do lancamento oficial."
      },
      {
        title: "Ajustes antes do lancamento",
        body: "Este texto e um ponto de partida. Antes de publicar, revise com os dados reais da empresa, canais de suporte e politicas LGPD aplicaveis."
      }
    ]
  },
  terms: {
    slug: "termos-de-uso",
    href: "/termos-de-uso",
    eyebrow: "Termos",
    title: "Termos de uso",
    description: "Condicoes iniciais para navegacao, pedidos de teste e uso da loja Bela Viva.",
    sections: [
      {
        title: "Loja em preparacao",
        body: "A Bela Viva ainda esta em fase de construcao. Pedidos e pagamentos desta versao sao simulados e nao geram cobranca real."
      },
      {
        title: "Catalogo e precos",
        body: "Produtos, marcas, estoque e precos podem mudar durante a fase de ajustes. A versao final deve confirmar disponibilidade antes de concluir uma venda."
      },
      {
        title: "Contato",
        body: "Duvidas comerciais, suporte e solicitacoes devem usar os canais oficiais exibidos na pagina de contato quando a loja for publicada."
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
        body: "Esta fase ainda nao compra etiquetas nem chama API real de transportadora. Depois podemos conectar Melhor Envio, Anjun ou outra operacao sem refazer o checkout."
      }
    ]
  },
  contact: {
    slug: "contato",
    href: "/contato",
    eyebrow: "Atendimento",
    title: "Contato",
    description: "Canais temporarios para revisar a experiencia de atendimento antes da publicacao oficial.",
    sections: [
      {
        title: "E-mail",
        body: "Use contato@belaviva.local como placeholder. Troque pelo e-mail real antes de publicar a loja."
      },
      {
        title: "WhatsApp",
        body: "Reserve este espaco para o numero comercial da Bela Viva e horarios de atendimento."
      },
      {
        title: "Status da loja",
        body: "A loja esta em fase de primeira versao. Pedidos feitos neste ambiente servem para teste operacional."
      }
    ]
  }
} satisfies Record<string, InfoPageContent>;

export const allInfoPages = Object.values(infoPages);

export function siteUrl(path = "") {
  const base = process.env.NEXT_PUBLIC_SITE_URL || siteConfig.defaultUrl;
  return new URL(path, base).toString();
}
