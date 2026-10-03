import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type ProductFixture = ReturnType<typeof productFixture>;

type FindManyArgs = {
  where?: { slug?: unknown };
  select?: unknown;
  include?: unknown;
  orderBy?: unknown;
  take?: number;
};

const testRoot = resolve(import.meta.dirname, "../../../..");
const moduleUrl = (relativePath: string) => pathToFileURL(resolve(testRoot, relativePath)).href;

let cartProducts: ProductFixture[] = [];
let recommendationProducts: ProductFixture[] = [];
let queries: FindManyArgs[] = [];
let findManyImpl: (args: FindManyArgs) => Promise<ProductFixture[]>;

function productFixture(overrides: Partial<{
  slug: string;
  name: string;
  priceCents: number;
  baseBoxPriceCents: number | null;
  baseBoxPieces: number | null;
  wholesalePackage: string | null;
  descriptionPt: string;
  image: string;
  stockStatus: string;
  active: boolean;
  badges: string[];
  reviewCount: number;
  brand: { name: string };
  category: { slug: string };
  inventory: { quantity: number } | null;
  skus: Array<{ quantity: number; active: boolean }>;
}> = {}) {
  return {
    slug: "produto-teste",
    name: "Produto Teste",
    priceCents: 250,
    baseBoxPriceCents: 1_000,
    baseBoxPieces: 4,
    wholesalePackage: "Embalagem fechada com 4 unidades; preço da embalagem: R$ 10,00.",
    descriptionPt: "",
    image: "/produto-teste.webp",
    stockStatus: "Em estoque",
    active: true,
    badges: [],
    reviewCount: 0,
    brand: { name: "Marca Teste" },
    category: { slug: "categoria-a" },
    inventory: { quantity: 100 },
    skus: [],
    ...overrides
  };
}

function isCartQuery(args: FindManyArgs) {
  return Boolean(args.where?.slug);
}

const prisma = {
  product: {
    findMany: (args: FindManyArgs) => findManyImpl(args)
  }
};

mock.module(moduleUrl("lib/db.ts"), { exports: { prisma } });

const { POST } = await import("./route");

function cartRequest(items: Array<{ slug: string; quantity: number }>) {
  return new Request("https://example.test/api/cart/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items })
  });
}

beforeEach(() => {
  cartProducts = [];
  recommendationProducts = [];
  queries = [];
  findManyImpl = async (args) => {
    queries.push(args);
    return isCartQuery(args) ? cartProducts : recommendationProducts;
  };
});

test("starts cart validation and recommendation queries before either query settles", async () => {
  const started = new Set<"cart" | "recommendations">();
  const fixture = productFixture();

  findManyImpl = (args) => {
    const query = isCartQuery(args) ? "cart" : "recommendations";
    started.add(query);

    return new Promise<ProductFixture[]>((resolveQuery, rejectQuery) => {
      queueMicrotask(() => {
        if (started.size !== 2) {
          rejectQuery(new Error(`query waterfall detected after ${query} started`));
          return;
        }
        resolveQuery(query === "cart" ? [fixture] : []);
      });
    });
  };

  const response = await POST(cartRequest([{ slug: fixture.slug, quantity: 4 }]));

  assert.equal(response.status, 200);
  assert.deepEqual([...started].sort(), ["cart", "recommendations"]);
});

test("keeps legacy package parsing and active-SKU stock fallback with the reduced projection", async () => {
  cartProducts = [
    productFixture({
      slug: "legado-sku",
      name: "Produto Legado com SKU",
      priceCents: 1_038,
      baseBoxPriceCents: null,
      baseBoxPieces: null,
      wholesalePackage: null,
      descriptionPt: "Preço unitário: 10,38; Embalagem para atacado: 373,50c/36pçs.",
      inventory: null,
      skus: [
        { quantity: 20, active: true },
        { quantity: 16, active: true },
        { quantity: 999, active: false }
      ]
    })
  ];

  const response = await POST(cartRequest([{ slug: "legado-sku", quantity: 36 }]));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.lines[0].packagePieces, 36);
  assert.equal(body.lines[0].packagePriceCents, 37_350);
  assert.equal(body.lines[0].stockQuantity, 36);
  assert.equal(body.lines[0].available, true);
  assert.equal(body.lines[0].lineTotalCents, 37_350);
});

test("preserves the complete cart response while selecting only fields used by wholesale and recommendation logic", async () => {
  cartProducts = [
    productFixture({ slug: "valido", name: "Produto Válido", image: "/valido.webp" }),
    productFixture({
      slug: "sem-estoque",
      name: "Produto Sem Estoque",
      image: "/sem-estoque.webp",
      inventory: { quantity: 0 }
    }),
    productFixture({ slug: "inativo", name: "Produto Inativo", image: "/inativo.webp", active: false }),
    productFixture({
      slug: "consulta",
      name: "Produto Sob Consulta",
      image: "/consulta.webp",
      baseBoxPriceCents: null,
      baseBoxPieces: 10,
      wholesalePackage: "Unidade de venda: pacote. Caixa sob consulta.",
      stockStatus: "Sob consulta",
      inventory: { quantity: 999 }
    }),
    productFixture({ slug: "multiplo-invalido", name: "Múltiplo Inválido", image: "/multiplo.webp" })
  ];
  recommendationProducts = [
    cartProducts[0],
    productFixture({
      slug: "recomendacao-categoria",
      name: "Recomendação da Categoria",
      image: "/recomendacao-categoria.webp",
      priceCents: 200,
      baseBoxPriceCents: 800,
      inventory: { quantity: 40 }
    }),
    productFixture({
      slug: "recomendacao-destaque",
      name: "Recomendação Destaque",
      image: "/recomendacao-destaque.webp",
      priceCents: 100,
      baseBoxPriceCents: 400,
      badges: ["Destaque"],
      reviewCount: 20,
      category: { slug: "categoria-b" },
      inventory: { quantity: 40 }
    })
  ];

  const response = await POST(cartRequest([
    { slug: "valido", quantity: 4 },
    { slug: "valido", quantity: 4 },
    { slug: "sem-estoque", quantity: 4 },
    { slug: "inativo", quantity: 4 },
    { slug: "consulta", quantity: 10 },
    { slug: "multiplo-invalido", quantity: 6 }
  ]));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    lines: [
      {
        slug: "valido",
        name: "Produto Válido",
        brandName: "Marca Teste",
        image: "/valido.webp",
        priceCents: 250,
        requestedQuantity: 8,
        quantity: 8,
        stockQuantity: 100,
        packagePieces: 4,
        packagePriceCents: 1_000,
        packageValid: true,
        packageCount: 2,
        active: true,
        available: true,
        warning: "",
        lineTotalCents: 2_000
      },
      {
        slug: "sem-estoque",
        name: "Produto Sem Estoque",
        brandName: "Marca Teste",
        image: "/sem-estoque.webp",
        priceCents: 250,
        requestedQuantity: 4,
        quantity: 4,
        stockQuantity: 0,
        packagePieces: 4,
        packagePriceCents: 1_000,
        packageValid: true,
        packageCount: 1,
        active: true,
        available: false,
        warning: "Produto sem estoque.",
        lineTotalCents: 1_000
      },
      {
        slug: "inativo",
        name: "Produto Inativo",
        brandName: "Marca Teste",
        image: "/inativo.webp",
        priceCents: 250,
        requestedQuantity: 4,
        quantity: 4,
        stockQuantity: 100,
        packagePieces: 4,
        packagePriceCents: 1_000,
        packageValid: true,
        packageCount: 1,
        active: false,
        available: false,
        warning: "Produto indisponível.",
        lineTotalCents: 1_000
      },
      {
        slug: "consulta",
        name: "Produto Sob Consulta",
        brandName: "Marca Teste",
        image: "/consulta.webp",
        priceCents: 250,
        requestedQuantity: 10,
        quantity: 10,
        stockQuantity: 0,
        packagePieces: 10,
        packagePriceCents: null,
        packageValid: true,
        packageCount: 1,
        active: true,
        available: false,
        warning: "Produto sem estoque.",
        lineTotalCents: 0
      },
      {
        slug: "multiplo-invalido",
        name: "Múltiplo Inválido",
        brandName: "Marca Teste",
        image: "/multiplo.webp",
        priceCents: 250,
        requestedQuantity: 6,
        quantity: 6,
        stockQuantity: 100,
        packagePieces: 4,
        packagePriceCents: 1_000,
        packageValid: false,
        packageCount: 1,
        active: true,
        available: true,
        warning: "Este produto é vendido somente em embalagem fechada com 4 unidades.",
        lineTotalCents: 0
      }
    ],
    subtotalCents: 2_000,
    discountCents: 0,
    totalCents: 2_000,
    minimumOrderCents: 50_000,
    remainingToMinimumCents: 48_000,
    minimumReached: false,
    packageReady: false,
    recommendations: [
      {
        slug: "recomendacao-categoria",
        name: "Recomendação da Categoria",
        brandName: "Marca Teste",
        image: "/recomendacao-categoria.webp",
        priceCents: 200,
        stockQuantity: 40,
        packagePieces: 4,
        reason: "Ajuda a fechar o mínimo"
      },
      {
        slug: "recomendacao-destaque",
        name: "Recomendação Destaque",
        brandName: "Marca Teste",
        image: "/recomendacao-destaque.webp",
        priceCents: 100,
        stockQuantity: 40,
        packagePieces: 4,
        reason: "Ajuda a fechar o mínimo"
      }
    ]
  });

  assert.equal(queries.length, 2);
  assert.equal("include" in queries[0], false);
  assert.equal("include" in queries[1], false);
  assert.deepEqual(queries[0].select, {
    slug: true,
    name: true,
    priceCents: true,
    baseBoxPriceCents: true,
    baseBoxPieces: true,
    wholesalePackage: true,
    descriptionPt: true,
    image: true,
    stockStatus: true,
    active: true,
    brand: { select: { name: true } },
    category: { select: { slug: true } },
    inventory: { select: { quantity: true } },
    skus: {
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { quantity: true, active: true }
    }
  });
  assert.deepEqual(queries[1].select, {
    ...queries[0].select as Record<string, unknown>,
    badges: true,
    reviewCount: true
  });
});
