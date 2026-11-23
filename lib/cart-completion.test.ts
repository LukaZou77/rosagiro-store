import assert from "node:assert/strict";
import test from "node:test";
import { getCartCompletionRecommendations, type CartCompletionProduct } from "./cart-completion";

const ORDER_QUANTITY_LIMIT = 2_147_483_647;

function product(overrides: Partial<CartCompletionProduct> = {}): CartCompletionProduct {
  return {
    slug: "produto-teste",
    name: "Produto Teste",
    image: "/produto-teste.webp",
    priceCents: 250,
    baseBoxPriceCents: 1_000,
    baseBoxPieces: 4,
    wholesalePackage: "Embalagem fechada com 4 unidades; preço da embalagem: R$ 10,00.",
    descriptionPt: "",
    stockStatus: "Em estoque",
    badges: [],
    active: true,
    rating: 0,
    reviewCount: 0,
    brand: { name: "Marca Teste" },
    category: { slug: "categoria-a", label: "Categoria A" },
    inventory: { quantity: 0 },
    skus: [],
    ...overrides
  };
}

test("recommends a published zero-stock product using a separate order quantity limit", () => {
  const recommendations = getCartCompletionRecommendations([product()], [], {
    minimumOrderCents: 50_000,
    cartSubtotalCents: 0
  });

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].slug, "produto-teste");
  assert.equal(recommendations[0].quantityLimit, ORDER_QUANTITY_LIMIT);
  assert.equal(Object.hasOwn(recommendations[0], "stockQuantity"), false);
});

test("recommends a source-consultation product only with an explicit package price", () => {
  const validSource = product({
    slug: "fonte-com-oferta",
    priceCents: 720,
    baseBoxPieces: 24,
    baseBoxPriceCents: 14_400,
    stockStatus: "Sob consulta",
    wholesalePackage: "Unidade de venda: pacote. Caixa: 24 unidades; preço da caixa: R$ 144,00."
  });
  const missingPrice = product({
    slug: "fonte-sem-preco",
    priceCents: 720,
    baseBoxPieces: 24,
    baseBoxPriceCents: null,
    stockStatus: "Sob consulta",
    wholesalePackage: "Unidade de venda: pacote. Caixa: 24 unidades; preço da caixa sob consulta."
  });

  const recommendations = getCartCompletionRecommendations([validSource, missingPrice], [], {
    minimumOrderCents: 50_000,
    cartSubtotalCents: 0
  });

  assert.deepEqual(recommendations.map((item) => item.slug), ["fonte-com-oferta"]);
  assert.equal(recommendations[0].packagePieces, 24);
  assert.equal(recommendations[0].packagePriceCents, 14_400);
});

test("excludes inactive, current-cart and malformed-package products", () => {
  const recommendations = getCartCompletionRecommendations([
    product({ slug: "inativo", active: false }),
    product({ slug: "no-carrinho" }),
    product({ slug: "sem-quantidade", baseBoxPieces: null, wholesalePackage: null }),
    product({ slug: "sem-preco", baseBoxPriceCents: null, priceCents: 0, wholesalePackage: null })
  ], [{ slug: "no-carrinho", quantity: 4 }]);

  assert.deepEqual(recommendations, []);
});
