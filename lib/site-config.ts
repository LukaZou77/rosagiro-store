export const siteConfig = {
  name: "Bela Viva",
  tagline: "beleza multimarcas",
  description: "Bela Viva, ecommerce multimarcas de beleza para o Brasil.",
  defaultUrl: "http://localhost:3000",
  supportEmail: "contato@belaviva.local",
  whatsappLabel: "+55 11 90000-0000",
  whatsappHref: "https://wa.me/5511900000000",
  marketplace: "Brasil",
  wholesale: {
    minimumOrderCents: 30000,
    minimumOrderTitle: "Pedido minimo",
    minimumOrderText: "Pedido minimo R$ 300,00 para compras no atacado. Nesta fase o pedido de teste nao sera bloqueado.",
    headerStrip: "PEDIDO MINIMO R$ 300,00 - ATACADO MULTIMARCAS - RECEBA EM CASA",
    serviceLabel: "Atendimento WhatsApp",
    storeTrust: "CNPJ e dados da loja serao revisados antes da publicacao oficial.",
    deliveryModes: [
      "Retirada local mediante confirmacao",
      "Transportadora ou excursao sob consulta",
      "Frete calculado na finalizacao do pedido"
    ],
    shelfSignals: ["Pedido minimo R$ 300", "Pronta entrega", "Compra para revenda", "Suporte no WhatsApp"]
  },
  hero: {
    eyebrow: "Atacado e varejo de beleza",
    title: "Multimarcas para montar kits, repor estoque e vender mais.",
    body: "Skincare, maquiagem, perfumes, cabelo e acessorios organizados para compras rapidas, reposicao de bancada e pedidos de atacado.",
    primaryCta: "Ver catalogo completo",
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
      label: "Atacadao piloto",
      text: "Pedido minimo R$ 300,00, multimarcas em pronta entrega e atendimento por WhatsApp para duvidas de compra.",
      cta: "Ver ofertas",
      href: "/categoria/all?sort=price-asc"
    },
    searchPlaceholder: "Buscar serum, batom, perfume, pincel...",
    stats: {
      productsLabel: "produtos ativos",
      categoriesLabel: "categorias de beleza",
      brandsLabel: "marcas no catalogo"
    },
    trustPoints: [
      "Pedido minimo R$ 300,00 sinalizado antes do checkout",
      "Pedido multimarcas em um carrinho",
      "Retirada, transportadora e excursao em preparacao",
      "Estoque visivel antes da confirmacao"
    ],
    quickActions: [
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
      title: "Compra minima clara, atendimento rapido e formas de entrega brasileiras.",
      body: "A vitrine ja orienta pedido minimo, estoque, pronta entrega e consulta por WhatsApp. Depois podemos adicionar preco por quantidade, cupons e tabelas de atacado sem refazer a experiencia.",
      primaryCta: "Ver todos os produtos",
      secondaryCta: "Falar no WhatsApp"
    },
    shelfNote: "Use a importacao CSV para trocar nomes, precos, estoque e descricao quando os produtos reais chegarem."
  }
};

export const storefrontLinks = [
  { href: "/categoria/all", label: "Categorias" },
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
        body: "A loja trabalha com entrega padrao e expressa no fluxo de teste. A comunicacao tambem reserva espaco para retirada local, transportadora e excursao, comuns em compras por atacado."
      },
      {
        title: "Frete gratis",
        body: "A regra atual oferece frete gratis a partir de R$ 299,00. Esta regra fica centralizada para facilitar ajustes comerciais."
      },
      {
        title: "Integracoes futuras",
        body: "A segunda fase prepara o caminho para transportadoras, regras por CEP e combinacao via WhatsApp, mas ainda nao conecta uma logistica real."
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
