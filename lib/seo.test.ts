import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogIndexing,
  categoryIntroText,
  categoryMetaDescription,
  categoryMetadataTitle,
  guideArticleJsonLd,
  itemListJsonLd,
  productMetaDescription
} from "@/lib/seo";

const mojibakePattern = /[莽茫谩贸煤铆玫锚]/;

const sampleProduct = {
  name: "Batom Duo Lip Twice Ruby Rose HB-L6203",
  slug: "batom-duo-lip-twice-ruby-rose-hb-l6203",
  priceCents: 975,
  descriptionPt: "Batom líquido para reposição em loja e compra no atacado.",
  image: "/uploads/products/batom.jpg",
  gallery: [],
  volume: "",
  finish: "",
  weightGrams: null,
  brand: { name: "Ruby Rose" },
  category: { label: "Lábios" },
  inventory: { quantity: 12 },
  skus: []
} as unknown as Parameters<typeof productMetaDescription>[0];

test("builds local Portuguese category metadata without mechanical wording", () => {
  assert.equal(categoryMetadataTitle("Todas as categorias", true), "Cosméticos no atacado para revenda");
  assert.equal(categoryMetadataTitle("Rosto", false), "Rosto no atacado para revenda");

  const description = categoryMetaDescription("Rosto", 326, false);
  assert.match(description, /Rosto no atacado/i);
  assert.match(description, /326 produtos/i);
  assert.match(description, /pedido mínimo R\$ 300,00/i);
  assert.doesNotMatch(description, /produto\(s\)|catálogo RosaGiro:/i);
  assert.doesNotMatch(description, mojibakePattern);
});

test("builds category intro copy for the rendered shelf", () => {
  const intro = categoryIntroText("Lábios", 42, false);
  assert.match(intro, /Lábios no atacado/i);
  assert.match(intro, /42 produtos/i);
  assert.match(intro, /lojistas|revenda/i);
  assert.doesNotMatch(intro, mojibakePattern);
});

test("builds natural product metadata for wholesale product pages", () => {
  const description = productMetaDescription(sampleProduct);
  assert.match(description, /Ruby Rose/i);
  assert.match(description, /preço/i);
  assert.match(description, /em estoque/i);
  assert.match(description, /pedido mínimo R\$ 300,00/i);
  assert.doesNotMatch(description, mojibakePattern);
});

test("builds ItemList JSON-LD with absolute product URLs", () => {
  const data = itemListJsonLd([
    { name: "Produto A", path: "/produto/produto-a" },
    { name: "Produto B", path: "/produto/produto-b" }
  ]);

  assert.equal(data["@type"], "ItemList");
  assert.equal(data.itemListElement[0].position, 1);
  assert.equal(data.itemListElement[0].url, "http://localhost:3000/produto/produto-a");
  assert.equal(data.itemListElement[1].name, "Produto B");
});

test("builds Article JSON-LD for published guide pages", () => {
  const data = guideArticleJsonLd({
    slug: "como-comprar-cosmeticos-no-atacado",
    title: "Como comprar cosméticos no atacado",
    excerpt: "Guia para montar um pedido de revenda com mais segurança.",
    coverImage: "/uploads/guides/atacado.jpg",
    publishedAt: new Date("2026-07-01T12:00:00.000Z"),
    updatedAt: new Date("2026-07-02T12:00:00.000Z")
  });

  assert.equal(data["@type"], "Article");
  assert.equal(data.headline, "Como comprar cosméticos no atacado");
  assert.equal(data.mainEntityOfPage, "http://localhost:3000/guias/como-comprar-cosmeticos-no-atacado");
  assert.equal(data.datePublished, "2026-07-01T12:00:00.000Z");
  assert.equal(data.publisher["@id"], "http://localhost:3000/#store");
});

test("keeps paginated category pages self-canonical", () => {
  assert.deepEqual(
    catalogIndexing({
      path: "/categoria/all",
      page: 2,
      query: "",
      brand: "all",
      stockFilter: "all",
      sort: "featured",
      totalPages: 17
    }),
    {
      canonicalPath: "/categoria/all?page=2",
      shouldNoIndex: false
    }
  );
});

test("keeps filtered catalog URLs out of the index", () => {
  assert.deepEqual(
    catalogIndexing({
      path: "/categoria/all",
      page: 1,
      query: "",
      brand: "Ruby Rose",
      stockFilter: "ready",
      sort: "price-asc",
      totalPages: 17
    }),
    {
      canonicalPath: "/categoria/all",
      shouldNoIndex: true
    }
  );
});

test("marks out-of-range catalog pages as non-indexable", () => {
  assert.deepEqual(
    catalogIndexing({
      path: "/categoria/all",
      page: 99,
      query: "",
      brand: "all",
      stockFilter: "all",
      sort: "featured",
      totalPages: 17
    }),
    {
      canonicalPath: "/categoria/all",
      shouldNoIndex: true
    }
  );
});
