import { scryptSync, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for seeding.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

const categories = [
  { slug: "skincare", label: "Skincare", note: "Limpeza, tratamento e protecao diaria" },
  { slug: "makeup", label: "Maquiagem", note: "Cor, acabamento e longa duracao" },
  { slug: "fragrance", label: "Perfumes", note: "Assinaturas leves, florais e amadeiradas" },
  { slug: "body", label: "Corpo", note: "Hidratacao, banho e cuidado sensorial" },
  { slug: "hair", label: "Cabelos", note: "Rotinas para brilho, cachos e reparacao" },
  { slug: "tools", label: "Acessorios", note: "Pinceis, necessaires e ferramentas" }
];

const brands = [
  {
    slug: "auralab",
    name: "AuraLab",
    logo: "AL",
    origin: "Sao Paulo, Brasil",
    descriptionPt: "Skincare de textura leve para rotinas urbanas.",
    featured: true,
    categorySlugs: ["skincare", "body"]
  },
  {
    slug: "nativa-cura",
    name: "Nativa Cura",
    logo: "NC",
    origin: "Curitiba, Brasil",
    descriptionPt: "Formulas botanicas com toque profissional.",
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
    origin: "Florianopolis, Brasil",
    descriptionPt: "Cuidado capilar com finalizacao limpa e brilhante.",
    featured: false,
    categorySlugs: ["hair", "tools"]
  },
  {
    slug: "bela-viva",
    name: "Bela Viva",
    logo: "BV",
    origin: "Brasil",
    descriptionPt: "Curadoria propria para organizar rotinas de beleza.",
    featured: false,
    categorySlugs: ["tools"]
  }
];

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
    benefits: ["Ilumina sem pesar", "Textura rapida", "Bom sob protetor solar"],
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
    benefits: ["pH gentil", "Nao resseca", "Uso diario"],
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
    benefits: ["Esfuma facil", "Nao marca textura", "Multifuncional"],
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
    descriptionPt: "Batom satin com pigmento intenso e conforto de longa duracao.",
    benefits: ["Alta pigmentacao", "Nao craquela", "Cor sofisticada"],
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
    descriptionPt: "Hidratante corporal de absorcao rapida com perfume macio.",
    benefits: ["Pele macia", "Nao mela", "Perfume elegante"],
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
    benefits: ["Brilho imediato", "Controle de frizz", "Nao pesa"],
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
    brand: "Bela Viva",
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
    badges: ["Bela Viva"]
  }
];

function cents(value: number | null) {
  if (value === null) return null;
  return Math.round(value * 100);
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
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

    const record = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        brandId: brand.id,
        categoryId: category.id,
        name: product.name,
        subcategory: product.subcategory,
        priceCents: cents(product.priceBRL) ?? 0,
        compareAtPriceCents: cents(product.compareAtPriceBRL),
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

  const email = process.env.ADMIN_EMAIL || "admin@belaviva.local";
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD is required for seeding.");

  await prisma.adminUser.upsert({
    where: { email },
    update: {
      name: "Bela Viva Admin",
      passwordHash: hashPassword(password),
      active: true
    },
    create: {
      email,
      name: "Bela Viva Admin",
      passwordHash: hashPassword(password),
      active: true
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Bela Viva seed complete.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
