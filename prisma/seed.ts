import { scryptSync, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Prisma } from "../src/generated/prisma/client";
import { BODY_AREA_CATEGORIES, LEGACY_CATEGORY_SLUGS, resolveBodyAreaCategorySlug } from "../lib/category-taxonomy";
import { infoPages } from "../lib/site-config";
import { INTERNAL_AVAILABLE_STOCK_QUANTITY } from "../lib/product-stock";
import { normalizeSubcategoryText, productSubcategorySeeds, subcategorySlug } from "../lib/product-subcategories";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for seeding.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

const categories = BODY_AREA_CATEGORIES;

const brands = [
  {
    slug: "auralab",
    name: "AuraLab",
    logo: "AL",
    origin: "São Paulo, Brasil",
    descriptionPt: "Skincare de textura leve para rotinas urbanas.",
    featured: true,
    categorySlugs: ["rosto", "corpo-banho"]
  },
  {
    slug: "nativa-cura",
    name: "Nativa Cura",
    logo: "NC",
    origin: "Curitiba, Brasil",
    descriptionPt: "Fórmulas botânicas com toque profissional.",
    featured: true,
    categorySlugs: ["rosto", "cabelos"]
  },
  {
    slug: "velvet-rua",
    name: "Velvet Rua",
    logo: "VR",
    origin: "Rio de Janeiro, Brasil",
    descriptionPt: "Maquiagem sofisticada para pele real.",
    featured: true,
    categorySlugs: ["rosto", "labios", "olhos-sobrancelhas"]
  },
  {
    slug: "casa-figo",
    name: "Casa Figo",
    logo: "CF",
    origin: "Belo Horizonte, Brasil",
    descriptionPt: "Fragrancias de banho e perfume para todos os dias.",
    featured: false,
    categorySlugs: ["perfumes", "corpo-banho"]
  },
  {
    slug: "linha-lume",
    name: "Linha Lume",
    logo: "LL",
    origin: "Florianópolis, Brasil",
    descriptionPt: "Cuidado capilar com finalização limpa e brilhante.",
    featured: false,
    categorySlugs: ["cabelos", "acessorios"]
  },
  {
    slug: "rosagiro",
    name: "RosaGiro",
    logo: "RG",
    origin: "São Paulo, Brasil",
    descriptionPt: "Curadoria própria para organizar compras de cosméticos no atacado.",
    featured: false,
    categorySlugs: ["acessorios"]
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
  shippingNote: "Enviamos para todo o Brasil com cotação por CEP. Algumas regiões podem exigir confirmação de cobertura, prazo, seguro ou taxa adicional pelo WhatsApp.",
  paymentNote: "Pix, cartão e pagamento com atendimento estão preparados para a fase de validação.",
  pixPaymentEnabled: false,
  pixAccountType: "TEMPORARY_PERSONAL",
  pixRecipientName: "",
  pixRecipientDocument: "",
  pixKeyType: "RANDOM",
  pixKey: "",
  pixBankName: "",
  mercadoPagoMaxInstallments: 6,
  pixInstructions: "Finalize o pedido, faça o Pix e envie o comprovante pelo WhatsApp para confirmação do atendimento.",
  exchangeNote: "Trocas e devoluções seguem política própria antes da publicação oficial.",
  trustBadges: ["Atendimento por WhatsApp", "Entrega para todo o Brasil", "Pedido mínimo sinalizado"],
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
    itemKey: "shipping-melhor-envio",
    group: "Logística",
    title: "Melhor Envio e regras de frete",
    description: "Confirmar token de produção, origem de envio, CEPs, peso dos produtos e perfis técnicos de embalagem.",
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
    category: "rosto",
    subcategory: "Sérum facial",
    priceBRL: 149.9,
    image: "/assets/products/aura-serum.svg",
    descriptionPt: "Serum antioxidante de toque seco para luminosidade e tom mais uniforme.",
    benefits: [],
    ingredients: [],
    skinType: "",
    finish: "",
    volume: "",
    rating: 0,
    reviewCount: 0,
    stockStatus: "Em estoque",
    badges: []
  },
  {
    slug: "nativa-gel-limpeza",
    brand: "Nativa Cura",
    name: "Gel de Limpeza Equilibrio",
    category: "rosto",
    subcategory: "Gel de limpeza facial",
    priceBRL: 82.5,
    image: "/assets/products/nativa-cleanser.svg",
    descriptionPt: "Limpeza suave para remover oleosidade sem sensacao repuxada.",
    benefits: [],
    ingredients: [],
    skinType: "",
    finish: "",
    volume: "",
    rating: 0,
    reviewCount: 0,
    stockStatus: "Em estoque",
    badges: []
  },
  {
    slug: "velvet-balm",
    brand: "Velvet Rua",
    name: "Balm Tinto Rosa Veludo",
    category: "labios",
    subcategory: "Balm labial",
    priceBRL: 69.9,
    image: "/assets/products/velvet-balm.svg",
    descriptionPt: "Balm pigmentado com brilho confortavel e cor construivel.",
    benefits: [],
    ingredients: [],
    skinType: "",
    finish: "",
    volume: "",
    rating: 0,
    reviewCount: 0,
    stockStatus: "Em estoque",
    badges: []
  },
  {
    slug: "solar-mist-fps",
    brand: "AuraLab",
    name: "Bruma Solar FPS 50",
    category: "rosto",
    subcategory: "Creme facial",
    priceBRL: 119.9,
    image: "/assets/products/solar-mist.svg",
    descriptionPt: "Protetor em bruma para reaplicar ao longo do dia, inclusive sobre maquiagem.",
    benefits: [],
    ingredients: [],
    skinType: "",
    finish: "",
    volume: "",
    rating: 0,
    reviewCount: 0,
    stockStatus: "Em estoque",
    badges: []
  },
  {
    slug: "flora-blush",
    brand: "Velvet Rua",
    name: "Blush Creme Flora",
    category: "rosto",
    subcategory: "Blush",
    priceBRL: 94.9,
    image: "/assets/products/flora-blush.svg",
    descriptionPt: "Blush cremoso de acabamento natural para um rubor fresco.",
    benefits: [],
    ingredients: [],
    skinType: "",
    finish: "",
    volume: "",
    rating: 0,
    reviewCount: 0,
    stockStatus: "Em estoque",
    badges: []
  },
  {
    slug: "noite-lipstick",
    brand: "Velvet Rua",
    name: "Batom Noite de Seda",
    category: "labios",
    subcategory: "Batom",
    priceBRL: 76.9,
    image: "/assets/products/noite-lip.svg",
    descriptionPt: "Batom satin com pigmento intenso e conforto de longa duração.",
    benefits: [],
    ingredients: [],
    skinType: "",
    finish: "",
    volume: "",
    rating: 0,
    reviewCount: 0,
    stockStatus: "Em estoque",
    badges: []
  },
  {
    slug: "bruma-figo",
    brand: "Casa Figo",
    name: "Bruma Perfumada Figo Verde",
    category: "perfumes",
    subcategory: "Body splash",
    priceBRL: 98.0,
    image: "/assets/products/bruma-figo.svg",
    descriptionPt: "Bruma fresca com notas de figo, folhas verdes e musk limpo.",
    benefits: [],
    ingredients: [],
    skinType: "",
    finish: "",
    volume: "",
    rating: 0,
    reviewCount: 0,
    stockStatus: "Em estoque",
    badges: []
  },
  {
    slug: "madeira-eau",
    brand: "Casa Figo",
    name: "Eau de Parfum Madeira Clara",
    category: "perfumes",
    subcategory: "Perfume",
    priceBRL: 229.9,
    image: "/assets/products/madeira-eau.svg",
    descriptionPt: "Assinatura amadeirada limpa com abertura citrica e fundo cremoso.",
    benefits: [],
    ingredients: [],
    skinType: "",
    finish: "",
    volume: "",
    rating: 0,
    reviewCount: 0,
    stockStatus: "Em estoque",
    badges: []
  },
  {
    slug: "corpo-amendoa",
    brand: "AuraLab",
    name: "Creme Corpo Amendoa Clara",
    category: "corpo-banho",
    subcategory: "Creme hidratante corporal",
    priceBRL: 109.9,
    image: "/assets/products/corpo-amendoa.svg",
    descriptionPt: "Hidratante corporal de absorção rápida com perfume macio.",
    benefits: [],
    ingredients: [],
    skinType: "",
    finish: "",
    volume: "",
    rating: 0,
    reviewCount: 0,
    stockStatus: "Em estoque",
    badges: []
  },
  {
    slug: "cachos-oleo",
    brand: "Linha Lume",
    name: "Oleo Cachos Luminosos",
    category: "cabelos",
    subcategory: "Óleo capilar",
    priceBRL: 88.9,
    image: "/assets/products/cachos-oleo.svg",
    descriptionPt: "Oleo leve para selar pontas, reduzir frizz e dar brilho.",
    benefits: [],
    ingredients: [],
    skinType: "",
    finish: "",
    volume: "",
    rating: 0,
    reviewCount: 0,
    stockStatus: "Em estoque",
    badges: []
  },
  {
    slug: "pincel-precisao",
    brand: "Linha Lume",
    name: "Pincel Precisao Duo",
    category: "acessorios",
    subcategory: "Pincel de maquiagem",
    priceBRL: 54.9,
    image: "/assets/products/pincel-precisao.svg",
    descriptionPt: "Pincel duo para corretivo, iluminador e pequenos detalhes.",
    benefits: [],
    ingredients: [],
    skinType: "",
    finish: "",
    volume: "",
    rating: 0,
    reviewCount: 0,
    stockStatus: "Em estoque",
    badges: []
  },
  {
    slug: "necessaire-viagem",
    brand: "RosaGiro",
    name: "Necessaire Curadoria",
    category: "acessorios",
    subcategory: "Nécessaire",
    priceBRL: 72.0,
    image: "/assets/products/necessaire.svg",
    descriptionPt: "Necessaire resistente para organizar rotina de bolsa, academia ou viagem.",
    benefits: [],
    ingredients: [],
    skinType: "",
    finish: "",
    volume: "",
    rating: 0,
    reviewCount: 0,
    stockStatus: "Em estoque",
    badges: []
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
  shippingNote: "Enviamos para todo o Brasil com cotação por CEP. Algumas regiões podem exigir confirmação de cobertura, prazo, seguro ou taxa adicional pelo WhatsApp.",
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
        title: "Dados de navegacao e metricas",
        body: "Registramos paginas visitadas, origem, tipo de dispositivo, localizacao aproximada e cliques para o WhatsApp. O IP nao e armazenado em formato bruto. Detalhes ficam por ate 90 dias, registros diarios pseudonimizados por ate 25 meses e totais sem identificadores podem ser preservados para relatorios historicos."
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
    description: "Informações iniciais sobre entrega nacional e modalidades de frete para pedidos no Brasil.",
    sections: [
      {
        title: "Modalidades",
        body: "Enviamos para todo o Brasil com cotação por CEP no checkout. Retirada local, transportadora e excursão continuam como opções de consulta pelo WhatsApp."
      },
      {
        title: "Cotacao por CEP",
        body: "O checkout consulta a Melhor Envio em tempo real, com origem em Sao Paulo, e inclui o frete escolhido no total antes do pagamento."
      },
      {
        title: "Cobertura e prazo",
        body: "As opcoes dependem do CEP, peso, dimensoes e servicos habilitados. Sem cotacao valida, o pedido de entrega nao segue para pagamento."
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
  "shipping-melhor-envio": {
    group: "Logistica",
    title: "Melhor Envio e regras de frete",
    description: "Confirmar token de producao, origem, CEPs, peso dos produtos e perfis tecnicos de embalagem."
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

function wholesaleSeedDetails() {
  return {
    suggestedQuantity: null,
    kitRecommendation: null,
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

async function migrateLegacyProductCategories(categoryRecords: Map<string, { id: string }>) {
  const legacyProducts = await prisma.product.findMany({
    where: { category: { slug: { in: [...LEGACY_CATEGORY_SLUGS] } } },
    select: {
      id: true,
      name: true,
      subcategory: true,
      category: { select: { slug: true, label: true } }
    }
  });

  for (const product of legacyProducts) {
    const targetSlug = resolveBodyAreaCategorySlug({
      categorySlug: product.category.slug,
      categoryLabel: product.category.label,
      subcategory: product.subcategory,
      name: product.name
    });
    const targetCategory = categoryRecords.get(targetSlug);
    if (!targetCategory) continue;

    await prisma.product.update({
      where: { id: product.id },
      data: { categoryId: targetCategory.id }
    });
  }

  await prisma.category.deleteMany({
    where: {
      slug: { in: [...LEGACY_CATEGORY_SLUGS] },
      products: { none: {} }
    }
  });
}

async function seedProductSubcategories(categoryRecords: Map<string, { id: string }>) {
  const subcategoryRecords = new Map<string, { id: string; label: string }>();

  for (const group of productSubcategorySeeds) {
    const category = categoryRecords.get(group.categorySlug);
    if (!category) continue;

    for (const [index, label] of group.labels.entries()) {
      const record = await prisma.productSubcategory.upsert({
        where: {
          categoryId_slug: {
            categoryId: category.id,
            slug: subcategorySlug(label)
          }
        },
        update: {
          label,
          sortOrder: (index + 1) * 10
        },
        create: {
          categoryId: category.id,
          slug: subcategorySlug(label),
          label,
          sortOrder: (index + 1) * 10
        }
      });
      subcategoryRecords.set(`${group.categorySlug}:${normalizeSubcategoryText(label)}`, record);
    }
  }

  return subcategoryRecords;
}

async function ensureSeedProductSubcategory(
  subcategoryRecords: Map<string, { id: string; label: string }>,
  categorySlug: string,
  categoryId: string,
  label: string
) {
  const key = `${categorySlug}:${normalizeSubcategoryText(label)}`;
  const existing = subcategoryRecords.get(key);
  if (existing) return existing;

  const record = await prisma.productSubcategory.upsert({
    where: {
      categoryId_slug: {
        categoryId,
        slug: subcategorySlug(label)
      }
    },
    update: { label },
    create: {
      categoryId,
      slug: subcategorySlug(label),
      label,
      sortOrder: 1000
    }
  });
  subcategoryRecords.set(key, record);
  return record;
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

  await migrateLegacyProductCategories(categoryRecords);
  const subcategoryRecords = await seedProductSubcategories(categoryRecords);

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
    const subcategory = await ensureSeedProductSubcategory(subcategoryRecords, product.category, category.id, product.subcategory);
    const wholesaleDetails = wholesaleSeedDetails();

    const record = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        brandId: brand.id,
        categoryId: category.id,
        subcategoryId: subcategory.id,
        name: product.name,
        subcategory: subcategory.label,
        priceCents: cents(product.priceBRL) ?? 0,
        compareAtPriceCents: null,
        weightGrams: null,
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
        subcategoryId: subcategory.id,
        name: product.name,
        subcategory: subcategory.label,
        priceCents: cents(product.priceBRL) ?? 0,
        compareAtPriceCents: null,
        weightGrams: null,
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
      update: { quantity: INTERNAL_AVAILABLE_STOCK_QUANTITY },
      create: { productId: record.id, quantity: INTERNAL_AVAILABLE_STOCK_QUANTITY }
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
