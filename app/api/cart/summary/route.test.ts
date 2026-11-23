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
const ORDER_QUANTITY_LIMIT = 2_147_483_647;

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

test("keeps legacy package parsing and reports raw stock separately from the order quantity limit", async () => {
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
  assert.equal(body.lines[0].priceCents, 1_038);
  assert.equal(body.lines[0].stockQuantity, 36);
  assert.equal(body.lines[0].quantityLimit, ORDER_QUANTITY_LIMIT);
  assert.equal(body.lines[0].available, true);
  assert.equal(body.lines[0].lineTotalCents, 37_350);
});

test("allows zero-stock and source-consultation products with verified package terms", async () => {
  cartProducts = [
    productFixture({
      slug: "consulta-com-oferta",
      name: "Produto Sob Consulta com Oferta",
      priceCents: 720,
      baseBoxPieces: 24,
      baseBoxPriceCents: 14_400,
      wholesalePackage: "Unidade de venda: pacote. Caixa: 24 unidades; preço da caixa: R$ 144,00.",
      stockStatus: "Sob consulta",
      inventory: { quantity: 0 }
    })
  ];

  const response = await POST(cartRequest([{ slug: "consulta-com-oferta", quantity: 24 }]));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.lines[0].available, true);
  assert.equal(body.lines[0].stockQuantity, 0);
  assert.equal(body.lines[0].quantityLimit, ORDER_QUANTITY_LIMIT);
  assert.equal(body.lines[0].packagePieces, 24);
  assert.equal(body.lines[0].packagePriceCents, 14_400);
  assert.equal(body.lines[0].priceCents, 600);
  assert.equal(body.lines[0].lineTotalCents, 14_400);
  assert.equal(body.lines[0].warning, "");
  assert.equal(body.packageReady, true);
});

test("keeps missing, inactive and incomplete package offers out of checkout", async () => {
  cartProducts = [
    productFixture({ slug: "inativo", active: false }),
    productFixture({
      slug: "consulta-sem-preco",
      priceCents: 720,
      baseBoxPieces: 24,
      baseBoxPriceCents: null,
      wholesalePackage: "Unidade de venda: pacote. Caixa: 24 unidades; preço da caixa sob consulta.",
      stockStatus: "Sob consulta",
      inventory: { quantity: 0 }
    })
  ];

  const response = await POST(cartRequest([
    { slug: "apagado-ou-ausente", quantity: 4 },
    { slug: "inativo", quantity: 4 },
    { slug: "consulta-sem-preco", quantity: 24 }
  ]));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.lines.map((line: { available: boolean; warning: string }) => [line.available, line.warning]), [
    [false, "Produto não encontrado."],
    [false, "Produto indisponível."],
    [false, "Embalagem ou preço sob consulta. Fale com o atendimento."]
  ]);
  assert.equal(body.lines[2].packagePriceCents, null);
  assert.equal(body.subtotalCents, 0);
  assert.equal(body.packageReady, false);
});

test("keeps the total cap even when inventory does not cap order quantity", async () => {
  cartProducts = [productFixture({
    baseBoxPieces: 1,
    baseBoxPriceCents: 2_147_483_647,
    wholesalePackage: null,
    inventory: { quantity: 0 }
  })];

  const response = await POST(cartRequest([{ slug: "produto-teste", quantity: 2 }]));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.lines[0].available, true);
  assert.equal(body.lines[0].lineTotalCents, 4_294_967_294);
  assert.match(body.orderLimitNotice, /ultrapassa o limite aceito/i);
  assert.equal(body.packageReady, false);
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
        quantityLimit: ORDER_QUANTITY_LIMIT,
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
        quantityLimit: ORDER_QUANTITY_LIMIT,
        packagePieces: 4,
        packagePriceCents: 1_000,
        packageValid: true,
        packageCount: 1,
        active: true,
        available: true,
        warning: "",
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
        quantityLimit: ORDER_QUANTITY_LIMIT,
        packagePieces: 4,
        packagePriceCents: 1_000,
        packageValid: true,
        packageCount: 1,
        active: false,
        available: false,
        warning: "Produto indisponível.",
        lineTotalCents: 0
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
        quantityLimit: ORDER_QUANTITY_LIMIT,
        packagePieces: 10,
        packagePriceCents: null,
        packageValid: true,
        packageCount: 1,
        active: true,
        available: false,
        warning: "Embalagem ou preço sob consulta. Fale com o atendimento.",
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
        quantityLimit: ORDER_QUANTITY_LIMIT,
        packagePieces: 4,
        packagePriceCents: 1_000,
        packageValid: false,
        packageCount: 0,
        active: true,
        available: true,
        warning: "Este produto é vendido somente em embalagem fechada com 4 unidades.",
        lineTotalCents: 0
      }
    ],
    subtotalCents: 3_000,
    discountCents: 0,
    totalCents: 3_000,
    minimumOrderCents: 50_000,
    remainingToMinimumCents: 47_000,
    minimumReached: false,
    packageReady: false,
    recommendations: [
      {
        slug: "recomendacao-categoria",
        name: "Recomendação da Categoria",
        brandName: "Marca Teste",
        image: "/recomendacao-categoria.webp",
        priceCents: 200,
        packagePriceCents: 1_000,
        quantityLimit: ORDER_QUANTITY_LIMIT,
        packagePieces: 4,
        reason: "Ajuda a fechar o mínimo"
      },
      {
        slug: "recomendacao-destaque",
        name: "Recomendação Destaque",
        brandName: "Marca Teste",
        image: "/recomendacao-destaque.webp",
        priceCents: 100,
        packagePriceCents: 1_000,
        quantityLimit: ORDER_QUANTITY_LIMIT,
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
