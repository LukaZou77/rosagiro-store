import { scryptSync, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Prisma } from "../src/generated/prisma/client";
import { infoPages } from "../lib/site-config";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for seeding.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

const categories = [
  { slug: "skincare", label: "Skincare", note: "Limpeza, tratamento e proteção diária" },
  { slug: "makeup", label: "Maquiagem", note: "Cor, acabamento e longa duração" },
  { slug: "fragrance", label: "Perfumes", note: "Assinaturas leves, florais e amadeiradas" },
  { slug: "body", label: "Corpo", note: "Hidratação, banho e cuidado sensorial" },
  { slug: "hair", label: "Cabelos", note: "Rotinas para brilho, cachos e reparação" },
  { slug: "tools", label: "Acessórios", note: "Pincéis, nécessaires e ferramentas" }
];

const brands = [
  {
    slug: "auralab",
    name: "AuraLab",
    logo: "AL",
    origin: "São Paulo, Brasil",
    descriptionPt: "Skincare de textura leve para rotinas urbanas.",
    featured: true,
    categorySlugs: ["skincare", "body"]
  },
  {
    slug: "nativa-cura",
    name: "Nativa Cura",
    logo: "NC",
    origin: "Curitiba, Brasil",
    descriptionPt: "Fórmulas botânicas com toque profissional.",
    featured: true,
    categorySlugs: ["skincare", "hair"]
  },
  {
    slug: "velvet-rua",
    name: "Velvet Rua",
    logo: "VR",
    origin: "Rio de Janeiro, Brasil",
    descriptionPt: "Maquiagem sofisticada para pele real.",
    featured: true,
    categorySlugs: ["makeup"]
  },
  {
    slug: "casa-figo",
    name: "Casa Figo",
    logo: "CF",
    origin: "Belo Horizonte, Brasil",
    descriptionPt: "Fragrancias de banho e perfume para todos os dias.",
    featured: false,
    categorySlugs: ["fragrance", "body"]
  },
  {
    slug: "linha-lume",
    name: "Linha Lume",
    logo: "LL",
    origin: "Florianópolis, Brasil",
    descriptionPt: "Cuidado capilar com finalização limpa e brilhante.",
    featured: false,
    categorySlugs: ["hair", "tools"]
  },
  {
    slug: "rosagiro",
    name: "RosaGiro",
    logo: "RG",
    origin: "São Paulo, Brasil",
    descriptionPt: "Curadoria própria para organizar compras de cosméticos no atacado.",
    featured: false,
    categorySlugs: ["tools"]
  }
];

const storeProfile = {
  id: "main",
  storeName: "RosaGiro",
  legalName: "",
  cnpj: "00.000.000/0000-00",
  stateRegistration: "Isento ou a ajustar",
  cep: "00000-000",
  state: "SP",
  city: "São Paulo",
  district: "A ajustar",
  street: "Endereço em preparação",
  number: "S/N",
  complement: "Dados comerciais serão revisados antes da publicação.",
  email: "rosagiroatacado@gmail.com",
  whatsapp: "+55 11 97079-2390",
  businessHours: "Segunda a sexta, 9h às 18h",
  instagramUrl: "",
  facebookUrl: "",
  tiktokUrl: "",
  pickupNote: "Retirada local mediante confirmação pelo atendimento.",
  shippingNote: "Anjun D2D Pickup, transportadora e excursão serão confirmadas antes do envio.",
  paymentNote: "Pix, cartão e pagamento com atendimento estão preparados para a fase de validação.",
  pixPaymentEnabled: false,
  pixAccountType: "TEMPORARY_PERSONAL",
  pixRecipientName: "",
  pixRecipientDocument: "",
  pixKeyType: "RANDOM",
  pixKey: "",
  pixBankName: "",
  pixInstructions: "Finalize o pedido, faça o Pix e envie o comprovante pelo WhatsApp para confirmação do atendimento.",
  exchangeNote: "Trocas e devoluções seguem política própria antes da publicação oficial.",
  trustBadges: ["Loja em preparação", "Atendimento por WhatsApp", "Pedido mínimo sinalizado"],
  launchNote: "Ambiente em preparação: pedidos e pagamentos desta versão são simulados."
};

const launchReadinessItems = [
  {
    itemKey: "store-legal-identity",
    group: "Loja",
    title: "Dados legais da loja",
    description: "Substituir CNPJ, inscrição estadual, razão social, endereço comercial e horário real de atendimento.",
    priority: 1,
    sortOrder: 10
  },
  {
    itemKey: "store-support-channels",
    group: "Loja",
    title: "Canais reais de atendimento",
    description: "Trocar WhatsApp, e-mail local e redes sociais por canais comerciais reais antes de publicar.",
    priority: 1,
    sortOrder: 20
  },
  {
    itemKey: "catalog-real-products",
    group: "Catálogo",
    title: "Catálogo real de produtos",
    description: "Importar SKUs reais, marcas, categorias, preços, descrições, imagens, estoque, peso, validade/lote e dados de compra no atacado.",
    priority: 1,
    sortOrder: 30
  },
  {
    itemKey: "catalog-media-quality",
    group: "Catálogo",
    title: "Imagens e mídia de produto",
    description: "Confirmar imagens finais dos produtos, padrão visual, links externos, ausência de placeholders e migração de uploads locais para armazenamento persistente antes da Vercel.",
    priority: 2,
    sortOrder: 40
  },
  {
    itemKey: "payment-mercado-pago-sandbox",
    group: "Pagamento",
    title: "Mercado Pago sandbox validado",
    description: "Configurar contas teste, access token sandbox, webhook secret e validar Checkout Pro com webhook HTTPS.",
    priority: 1,
    sortOrder: 50
  },
  {
    itemKey: "payment-live-cutover",
    group: "Pagamento",
    title: "Corte para pagamento real",
    description: "Revisar credenciais live, webhook público, valor recebido, estoque, chargeback, reembolso e monitoramento antes de cobrar clientes.",
    priority: 1,
    sortOrder: 60
  },
  {
    itemKey: "shipping-anjun-rates",
    group: "Logística",
    title: "Tabela Anjun e regras de frete",
    description: "Confirmar validade da tabela D2D Pickup, origem de envio, CEPs cobertos, peso de produtos e embalagem.",
    priority: 1,
    sortOrder: 70
  },
  {
    itemKey: "shipping-manual-fees",
    group: "Logística",
    title: "Taxas e conferência manual",
    description: "Definir como tratar seguro, ICMS/ISS, área de risco, excursão, transportadora e exceções antes de vender.",
    priority: 2,
    sortOrder: 80
  },
  {
    itemKey: "address-google-maps",
    group: "Endereço",
    title: "Google Maps opcional",
    description: "Se usar validação Google, configurar API key restrita e conferir autocomplete, details e address validation.",
    priority: 3,
    sortOrder: 90
  },
  {
    itemKey: "address-manual-review",
    group: "Endereço",
    title: "Conferência de endereço",
    description: "Definir rotina operacional para endereços com ViaCEP incompleto, Google desativado ou status needs review.",
    priority: 2,
    sortOrder: 100
  },
  {
    itemKey: "deploy-vercel-env",
    group: "Deploy",
    title: "Ambiente Vercel e variáveis",
    description: "Configurar domínio, NEXT_PUBLIC_SITE_URL, banco de produção, SESSION_SECRET, Mercado Pago e Google no ambiente correto.",
    priority: 1,
    sortOrder: 110
  },
  {
    itemKey: "deploy-production-db",
    group: "Deploy",
    title: "Banco de produção",
    description: "Executar migrate deploy, seed controlado, importação de dados reais e backup/rollback antes de publicar.",
    priority: 1,
    sortOrder: 120
  },
  {
    itemKey: "ops-policies-lgpd",
    group: "Operação",
    title: "Políticas e LGPD",
    description: "Revisar termos, privacidade, trocas, devoluções, entrega, atendimento, dados pessoais e regras de beleza.",
    priority: 1,
    sortOrder: 130
  },
  {
    itemKey: "ops-seo-merchant",
    group: "Operação",
    title: "SEO e canais comerciais",
    description: "Validar metadata, sitemap, robots, Open Graph, Google Merchant/feed e dados estruturados antes de divulgar.",
    priority: 2,
    sortOrder: 140
  }
] as const;

const products = [
  {
    slug: "aura-serum-c",
    brand: "AuraLab",
    name: "Serum C Aura 12%",
    category: "skincare",
    subcategory: "Tratamentos",
    priceBRL: 149.9,
    compareAtPriceBRL: 179.9,
    image: "/assets/products/aura-serum.svg",
    descriptionPt: "Serum antioxidante de toque seco para luminosidade e tom mais uniforme.",
    benefits: ["Ilumina sem pesar", "Textura rápida", "Bom sob protetor solar"],
    ingredients: ["Vitamina C", "Ferulico", "Niacinamida"],
    skinType: "Todos os tipos",
    finish: "Natural luminoso",
    volume: "30 ml",
    rating: 4.8,
    reviewCount: 214,
    stockStatus: "Em estoque",
    badges: ["Mais vendido", "Novo"]
  },
  {
    slug: "nativa-gel-limpeza",
    brand: "Nativa Cura",
    name: "Gel de Limpeza Equilibrio",
    category: "skincare",
    subcategory: "Limpeza",
    priceBRL: 82.5,
    compareAtPriceBRL: null,
    image: "/assets/products/nativa-cleanser.svg",
    descriptionPt: "Limpeza suave para remover oleosidade sem sensacao repuxada.",
    benefits: ["pH gentil", "Não resseca", "Uso diário"],
    ingredients: ["Cha verde", "Pantenol", "Glicerina"],
    skinType: "Mista e oleosa",
    finish: "Pele fresca",
    volume: "150 ml",
    rating: 4.7,
    reviewCount: 168,
    stockStatus: "Em estoque",
    badges: ["Derm-friendly"]
  },
  {
    slug: "velvet-balm",
    brand: "Velvet Rua",
    name: "Balm Tinto Rosa Veludo",
    category: "makeup",
    subcategory: "Labios",
    priceBRL: 69.9,
    compareAtPriceBRL: 89.9,
    image: "/assets/products/velvet-balm.svg",
    descriptionPt: "Balm pigmentado com brilho confortavel e cor construivel.",
    benefits: ["Conforto imediato", "Cor modulavel", "Bolsa essencial"],
    ingredients: ["Manteiga de karite", "Oleo de jojoba", "Vitamina E"],
    skinType: "Todos os tipos",
    finish: "Glow suave",
    volume: "4 g",
    rating: 4.6,
    reviewCount: 91,
    stockStatus: "Em estoque",
    badges: ["Oferta"]
  },
  {
    slug: "solar-mist-fps",
    brand: "AuraLab",
    name: "Bruma Solar FPS 50",
    category: "skincare",
    subcategory: "Protecao solar",
    priceBRL: 119.9,
    compareAtPriceBRL: null,
    image: "/assets/products/solar-mist.svg",
    descriptionPt: "Protetor em bruma para reaplicar ao longo do dia, inclusive sobre maquiagem.",
    benefits: ["Reaplicacao facil", "Acabamento invisivel", "Bolsa e praia"],
    ingredients: ["Filtros UVA/UVB", "Aloe vera", "Bisabolol"],
    skinType: "Todos os tipos",
    finish: "Invisivel",
    volume: "75 ml",
    rating: 4.5,
    reviewCount: 132,
    stockStatus: "Em estoque",
    badges: ["FPS 50"]
  },
  {
    slug: "flora-blush",
    brand: "Velvet Rua",
    name: "Blush Creme Flora",
    category: "makeup",
    subcategory: "Face",
    priceBRL: 94.9,
    compareAtPriceBRL: null,
    image: "/assets/products/flora-blush.svg",
    descriptionPt: "Blush cremoso de acabamento natural para um rubor fresco.",
    benefits: ["Esfuma fácil", "Não marca textura", "Multifuncional"],
    ingredients: ["Esqualano", "Pigmentos minerais", "Cera vegetal"],
    skinType: "Todos os tipos",
    finish: "Vicoso",
    volume: "6 g",
    rating: 4.9,
    reviewCount: 77,
    stockStatus: "Em estoque",
    badges: ["Favorito"]
  },
  {
    slug: "noite-lipstick",
    brand: "Velvet Rua",
    name: "Batom Noite de Seda",
    category: "makeup",
    subcategory: "Labios",
    priceBRL: 76.9,
    compareAtPriceBRL: null,
    image: "/assets/products/noite-lip.svg",
    descriptionPt: "Batom satin com pigmento intenso e conforto de longa duração.",
    benefits: ["Alta pigmentação", "Não craquela", "Cor sofisticada"],
    ingredients: ["Oleo de ameixa", "Cera de arroz", "Vitamina E"],
    skinType: "Todos os tipos",
    finish: "Satin",
    volume: "3,5 g",
    rating: 4.6,
    reviewCount: 64,
    stockStatus: "Em estoque",
    badges: ["Novo"]
  },
  {
    slug: "bruma-figo",
    brand: "Casa Figo",
    name: "Bruma Perfumada Figo Verde",
    category: "fragrance",
    subcategory: "Body splash",
    priceBRL: 98.0,
    compareAtPriceBRL: 118.0,
    image: "/assets/products/bruma-figo.svg",
    descriptionPt: "Bruma fresca com notas de figo, folhas verdes e musk limpo.",
    benefits: ["Leve para o dia", "Camadas com hidratante", "Sem excesso"],
    ingredients: ["Figo verde", "Musk", "Cedro claro"],
    skinType: "Todos os tipos",
    finish: "Fresco",
    volume: "120 ml",
    rating: 4.7,
    reviewCount: 103,
    stockStatus: "Em estoque",
    badges: ["Oferta"]
  },
  {
    slug: "madeira-eau",
    brand: "Casa Figo",
    name: "Eau de Parfum Madeira Clara",
    category: "fragrance",
    subcategory: "Perfume",
    priceBRL: 229.9,
    compareAtPriceBRL: null,
    image: "/assets/products/madeira-eau.svg",
    descriptionPt: "Assinatura amadeirada limpa com abertura citrica e fundo cremoso.",
    benefits: ["Elegante", "Boa fixacao", "Unissex"],
    ingredients: ["Bergamota", "Sandalwood", "Ambrox"],
    skinType: "Todos os tipos",
    finish: "Amadeirado limpo",
    volume: "50 ml",
    rating: 4.8,
    reviewCount: 58,
    stockStatus: "Em estoque",
    badges: ["Premium"]
  },
  {
    slug: "corpo-amendoa",
    brand: "AuraLab",
    name: "Creme Corpo Amendoa Clara",
    category: "body",
    subcategory: "Hidratantes",
    priceBRL: 109.9,
    compareAtPriceBRL: null,
    image: "/assets/products/corpo-amendoa.svg",
    descriptionPt: "Hidratante corporal de absorção rápida com perfume macio.",
    benefits: ["Pele macia", "Não mela", "Perfume elegante"],
    ingredients: ["Oleo de amendoa", "Ceramidas", "Manteiga de cupuacu"],
    skinType: "Normal a seca",
    finish: "Aveludado",
    volume: "220 ml",
    rating: 4.7,
    reviewCount: 145,
    stockStatus: "Em estoque",
    badges: ["Corpo"]
  },
  {
    slug: "cachos-oleo",
    brand: "Linha Lume",
    name: "Oleo Cachos Luminosos",
    category: "hair",
    subcategory: "Finalizadores",
    priceBRL: 88.9,
    compareAtPriceBRL: 105.9,
    image: "/assets/products/cachos-oleo.svg",
    descriptionPt: "Oleo leve para selar pontas, reduzir frizz e dar brilho.",
    benefits: ["Brilho imediato", "Controle de frizz", "Não pesa"],
    ingredients: ["Oleo de pracaxi", "Argan", "Vitamina E"],
    skinType: "Cabelos cacheados e ondulados",
    finish: "Brilho natural",
    volume: "60 ml",
    rating: 4.8,
    reviewCount: 121,
    stockStatus: "Em estoque",
    badges: ["Cachos"]
  },
  {
    slug: "pincel-precisao",
    brand: "Linha Lume",
    name: "Pincel Precisao Duo",
    category: "tools",
    subcategory: "Pinceis",
    priceBRL: 54.9,
    compareAtPriceBRL: null,
    image: "/assets/products/pincel-precisao.svg",
    descriptionPt: "Pincel duo para corretivo, iluminador e pequenos detalhes.",
    benefits: ["Cerdas macias", "Corte preciso", "Facil de lavar"],
    ingredients: ["Cerdas sinteticas", "Cabo reciclado"],
    skinType: "Todos os tipos",
    finish: "Precisao",
    volume: "1 unidade",
    rating: 4.5,
    reviewCount: 49,
    stockStatus: "Em estoque",
    badges: ["Acessorio"]
  },
  {
    slug: "necessaire-viagem",
    brand: "RosaGiro",
    name: "Necessaire Curadoria",
    category: "tools",
    subcategory: "Organizacao",
    priceBRL: 72.0,
    compareAtPriceBRL: null,
    image: "/assets/products/necessaire.svg",
    descriptionPt: "Necessaire resistente para organizar rotina de bolsa, academia ou viagem.",
    benefits: ["Compacta", "Forro lavavel", "Cabe produtos full size"],
    ingredients: ["Nylon premium", "Forro impermeavel"],
    skinType: "Todos os tipos",
    finish: "Organizacao",
    volume: "1 unidade",
    rating: 4.6,
    reviewCount: 36,
    stockStatus: "Em estoque",
    badges: ["RosaGiro"]
  }
];

const siteInfoPageKeys = ["privacy", "terms", "returns", "shipping", "contact"] as const;

const legacyStoreProfileCopy = {
  legalName: "RosaGiro Comercio de Cosmeticos Ltda.",
  email: "contato@rosagiro.local",
  whatsapp: "+55 11 90000-0000",
  city: "Sao Paulo",
  street: "Endereco em preparacao",
  complement: "Dados comerciais serao revisados antes da publicacao.",
  businessHours: "Segunda a sexta, 9h as 18h",
  pickupNote: "Retirada local mediante confirmacao pelo atendimento.",
  shippingNote: "Anjun D2D Pickup, transportadora e excursao serao confirmadas antes do envio.",
  paymentNote: "Pix, cartao e pagamento simulado estao preparados para a fase de testes.",
  exchangeNote: "Trocas e devolucoes seguem politica propria antes da publicacao oficial.",
  launchNote: "Ambiente em preparacao: pedidos e pagamentos desta versao sao simulados."
} as const;

const legacyStoreTrustBadges = ["Loja em preparacao", "Atendimento por WhatsApp", "Pedido minimo sinalizado"];

const legacyInfoPageDefaults = {
  contact: {
    description: "Canais temporarios para revisar a experiencia de atendimento antes da publicacao oficial.",
    sections: [
      {
        title: "E-mail",
        body: "Use contato@rosagiro.local como placeholder. Troque pelo e-mail real antes de publicar a loja."
      },
      {
        title: "WhatsApp",
        body: "Reserve este espaco para o numero comercial da RosaGiro e horarios de atendimento."
      },
      {
        title: "Status da loja",
        body: "A loja esta em fase de primeira versao. Pedidos feitos neste ambiente servem para teste operacional."
      }
    ]
  },
  privacy: {
    eyebrow: "Politica",
    title: "Politica de privacidade",
    description: "Resumo editavel sobre como a RosaGiro pretende tratar dados de contato, entrega e pedidos.",
    sections: [
      {
        title: "Dados coletados",
        body: "Ao adicionar produtos ou iniciar o checkout podemos solicitar nome e WhatsApp para atendimento e compra no atacado. No checkout tambem coletamos e-mail, CPF e endereco para criar o pedido e simular a entrega."
      },
      {
        title: "Uso das informacoes",
        body: "Os dados sao usados para atendimento via WhatsApp, organizacao de clientes, processamento de pedidos e validacao operacional. Esta fase nao cria senha nem area publica de cliente."
      },
      {
        title: "Ajustes antes do lancamento",
        body: "Este texto e um ponto de partida. Antes de publicar, revise com os dados reais da empresa, canais de suporte e politicas LGPD aplicaveis."
      }
    ]
  },
  returns: {
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
  terms: {
    description: "Condicoes iniciais para navegacao, pedidos de teste e uso da loja RosaGiro.",
    sections: [
      {
        title: "Loja em preparacao",
        body: "A RosaGiro ainda esta em fase de construcao. Pedidos e pagamentos desta versao sao simulados e nao geram cobranca real."
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
  shipping: {
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
  }
} as const;

const previousContactSections = [
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
] as const;

const legacyLaunchReadinessCopy: Record<string, Partial<{ group: string; title: string; description: string }>> = {
  "store-legal-identity": {
    description: "Substituir CNPJ, inscricao estadual, razao social, endereco comercial, e horario real de atendimento."
  },
  "catalog-real-products": {
    group: "Catalogo",
    title: "Catalogo real de produtos",
    description: "Importar SKUs reais, marcas, categorias, precos, descricoes, imagens, estoque, peso, validade/lote e dados de compra no atacado."
  },
  "catalog-media-quality": {
    group: "Catalogo",
    title: "Imagens e midia de produto",
    description: "Confirmar imagens finais dos produtos, padrao visual, links externos, ausencia de placeholders e migracao de uploads locais para armazenamento persistente antes da Vercel."
  },
  "shipping-anjun-rates": {
    group: "Logistica"
  },
  "shipping-manual-fees": {
    group: "Logistica",
    title: "Taxas e conferencia manual",
    description: "Definir como tratar seguro, ICMS/ISS, area de risco, excursao, transportadora e excecoes antes de vender."
  },
  "address-google-maps": {
    group: "Endereco",
    description: "Se usar validacao Google, configurar API key restrita e conferir autocomplete, details e address validation."
  },
  "address-manual-review": {
    group: "Endereco",
    title: "Conferencia de endereco",
    description: "Definir rotina operacional para enderecos com ViaCEP incompleto, Google desativado ou status needs review."
  },
  "deploy-vercel-env": {
    title: "Ambiente Vercel e variaveis",
    description: "Configurar dominio, NEXT_PUBLIC_SITE_URL, banco de producao, SESSION_SECRET, Mercado Pago e Google no ambiente correto."
  },
  "deploy-production-db": {
    title: "Banco de producao",
    description: "Executar migrate deploy, seed controlado, importacao de dados reais e backup/rollback antes de publicar."
  },
  "ops-policies-lgpd": {
    group: "Operacao",
    title: "Politicas e LGPD",
    description: "Revisar termos, privacidade, trocas, devolucoes, entrega, atendimento, dados pessoais e regras de beleza."
  },
  "ops-seo-merchant": {
    group: "Operacao"
  }
};

function comparableSections(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.map((section) => {
    const item = section as { title?: unknown; body?: unknown };
    return {
      title: String(item.title || ""),
      body: String(item.body || "")
    };
  });
}

function jsonEquals(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cents(value: number | null) {
  if (value === null) return null;
  return Math.round(value * 100);
}

function wholesaleSeedDetails(product: (typeof products)[number]) {
  const suggestedByCategory: Record<string, number> = {
    skincare: 3,
    makeup: 6,
    fragrance: 2,
    body: 3,
    hair: 4,
    tools: 6
  };

  return {
    suggestedQuantity: suggestedByCategory[product.category] || 3,
    kitRecommendation:
      product.category === "tools"
        ? "Combine com produtos de maquiagem para montar kit de revenda."
        : `Combine com itens de ${product.subcategory.toLowerCase()} para montar reposicao.`,
    wholesalePackage: "Venda por unidade; caixa fechada e volume maior sob consulta.",
    validityNote: "Validade/lote sob conferência no atendimento antes do envio.",
    purchaseNote: "Para compra em volume, confirme estoque, cidade/UF e melhor forma de entrega pelo WhatsApp."
  };
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

async function applyExactDefaultCopyBackfills() {
  for (const [fieldName, legacyValue] of Object.entries(legacyStoreProfileCopy)) {
    const nextValue = storeProfile[fieldName as keyof typeof legacyStoreProfileCopy];
    const where = { id: storeProfile.id, [fieldName]: legacyValue } satisfies Prisma.StoreProfileWhereInput;
    const data = { [fieldName]: nextValue } satisfies Prisma.StoreProfileUpdateManyMutationInput;
    await prisma.storeProfile.updateMany({
      where,
      data
    });
  }

  await prisma.storeProfile.updateMany({
    where: {
      id: storeProfile.id,
      legalName: {
        in: ["RosaGiro Comércio de Cosméticos Ltda.", "RosaGiro化妆品贸易有限公司"]
      }
    },
    data: { legalName: "" }
  });

  await prisma.storeProfile.updateMany({
    where: { id: storeProfile.id, trustBadges: { equals: legacyStoreTrustBadges } },
    data: { trustBadges: storeProfile.trustBadges }
  });

  for (const pageKey of siteInfoPageKeys) {
    const legacyPage = legacyInfoPageDefaults[pageKey as keyof typeof legacyInfoPageDefaults];
    const nextPage = infoPages[pageKey];
    if (!legacyPage) continue;

    for (const fieldName of ["eyebrow", "title", "description"] as const) {
      const legacyText = (legacyPage as Partial<Record<typeof fieldName, string>>)[fieldName];
      if (legacyText) {
        const where = { pageKey, [fieldName]: legacyText } satisfies Prisma.SiteInfoPageWhereInput;
        const data = { [fieldName]: nextPage[fieldName] } satisfies Prisma.SiteInfoPageUpdateManyMutationInput;
        await prisma.siteInfoPage.updateMany({
          where,
          data
        });
      }
    }

    if ("sections" in legacyPage && legacyPage.sections) {
      const currentPage = await prisma.siteInfoPage.findUnique({
        where: { pageKey },
        select: { sections: true }
      });
      if (currentPage && jsonEquals(comparableSections(currentPage.sections), comparableSections(legacyPage.sections))) {
        await prisma.siteInfoPage.update({
          where: { pageKey },
          data: { sections: nextPage.sections }
        });
      }
    }
  }

  const contactPage = await prisma.siteInfoPage.findUnique({
    where: { pageKey: "contact" },
    select: { sections: true }
  });
  if (contactPage && jsonEquals(comparableSections(contactPage.sections), comparableSections(previousContactSections))) {
    await prisma.siteInfoPage.update({
      where: { pageKey: "contact" },
      data: { sections: infoPages.contact.sections }
    });
  }

  for (const item of launchReadinessItems) {
    const legacy = legacyLaunchReadinessCopy[item.itemKey];
    if (!legacy) continue;

    for (const fieldName of ["group", "title", "description"] as const) {
      const legacyValue = legacy[fieldName];
      if (!legacyValue) continue;
      const where = { itemKey: item.itemKey, [fieldName]: legacyValue } satisfies Prisma.LaunchReadinessItemWhereInput;
      const data = { [fieldName]: item[fieldName] } satisfies Prisma.LaunchReadinessItemUpdateManyMutationInput;
      await prisma.launchReadinessItem.updateMany({
        where,
        data
      });
    }
  }
}

async function main() {
  const categoryRecords = new Map<string, { id: string }>();
  const brandRecords = new Map<string, { id: string }>();

  for (const category of categories) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category
    });
    categoryRecords.set(category.slug, record);
  }

  for (const brand of brands) {
    const record = await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: brand,
      create: brand
    });
    brandRecords.set(brand.name, record);
  }

  for (const [index, product] of products.entries()) {
    const brand = brandRecords.get(product.brand);
    const category = categoryRecords.get(product.category);
    if (!brand || !category) throw new Error(`Missing relation for ${product.slug}`);
    const wholesaleDetails = wholesaleSeedDetails(product);

    const record = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        brandId: brand.id,
        categoryId: category.id,
        name: product.name,
        subcategory: product.subcategory,
        priceCents: cents(product.priceBRL) ?? 0,
        compareAtPriceCents: cents(product.compareAtPriceBRL),
        weightGrams: 150,
        ...wholesaleDetails,
        image: product.image,
        gallery: [product.image],
        descriptionPt: product.descriptionPt,
        benefits: product.benefits,
        ingredients: product.ingredients,
        skinType: product.skinType,
        finish: product.finish,
        volume: product.volume,
        rating: product.rating,
        reviewCount: product.reviewCount,
        stockStatus: product.stockStatus,
        badges: product.badges,
        active: true,
        featuredRank: index + 1
      },
      create: {
        slug: product.slug,
        brandId: brand.id,
        categoryId: category.id,
        name: product.name,
        subcategory: product.subcategory,
        priceCents: cents(product.priceBRL) ?? 0,
        compareAtPriceCents: cents(product.compareAtPriceBRL),
        weightGrams: 150,
        ...wholesaleDetails,
        image: product.image,
        gallery: [product.image],
        descriptionPt: product.descriptionPt,
        benefits: product.benefits,
        ingredients: product.ingredients,
        skinType: product.skinType,
        finish: product.finish,
        volume: product.volume,
        rating: product.rating,
        reviewCount: product.reviewCount,
        stockStatus: product.stockStatus,
        badges: product.badges,
        active: true,
        featuredRank: index + 1
      }
    });

    await prisma.inventory.upsert({
      where: { productId: record.id },
      update: { quantity: 48 },
      create: { productId: record.id, quantity: 48 }
    });
  }

  const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim();
  const email =
    configuredAdminEmail && !/^admin@belaviva\.local$/i.test(configuredAdminEmail)
      ? configuredAdminEmail
      : "admin@rosagiro.local";
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD is required for seeding.");

  await prisma.adminUser.upsert({
    where: { email },
    update: {
      name: "RosaGiro Admin",
      passwordHash: hashPassword(password),
      active: true
    },
    create: {
      email,
      name: "RosaGiro Admin",
      passwordHash: hashPassword(password),
      active: true
    }
  });

  await prisma.storeProfile.upsert({
    where: { id: "main" },
    update: {},
    create: storeProfile
  });

  for (const pageKey of siteInfoPageKeys) {
    const page = infoPages[pageKey];
    await prisma.siteInfoPage.upsert({
      where: { pageKey },
      update: {},
      create: {
        pageKey,
        slug: page.slug,
        href: page.href,
        eyebrow: page.eyebrow,
        title: page.title,
        description: page.description,
        sections: page.sections,
        active: true
      }
    });
  }

  for (const item of launchReadinessItems) {
    await prisma.launchReadinessItem.upsert({
      where: { itemKey: item.itemKey },
      update: {
        priority: item.priority,
        sortOrder: item.sortOrder
      },
      create: item
    });
  }

  await applyExactDefaultCopyBackfills();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("RosaGiro seed complete.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
