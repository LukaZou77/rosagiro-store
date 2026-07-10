import assert from "node:assert/strict";
import test from "node:test";
import { GuideArticleValidationError, validateGuideArticleInput } from "@/lib/guide-article-input";

const baseGuide = {
  title: "Como montar pedido de maquiagem para revenda",
  slug: "como-montar-pedido-maquiagem-revenda",
  excerpt: "Passos objetivos para organizar uma compra de maquiagem no atacado.",
  coverImage: "/assets/rosagiro-atacado-hero.webp",
  coverImageAlt: "Produtos de beleza organizados em uma prateleira.",
  body: "Comece com os itens de maior giro.\n\nConfirme estoque, lote e prazo antes de fechar o pedido.",
  authorName: "Equipe RosaGiro",
  reviewerName: "Responsavel pelo estoque",
  reviewedAt: "2026-07-10",
  sourceNotes: "Conferencia interna de catalogo, estoque e regras de entrega RosaGiro.",
  active: true,
  sortOrder: 1
};

test("requires transparent editorial information before publishing a guide", () => {
  const guide = validateGuideArticleInput(baseGuide);
  assert.equal(guide.authorName, "Equipe RosaGiro");
  assert.equal(guide.reviewedAt?.toISOString(), "2026-07-10T12:00:00.000Z");

  assert.throws(
    () => validateGuideArticleInput({ ...baseGuide, reviewerName: "" }),
    (error: unknown) => error instanceof GuideArticleValidationError && /Para publicar/.test(error.message)
  );
});

test("allows incomplete editorial metadata only while a guide remains a draft", () => {
  const guide = validateGuideArticleInput({
    ...baseGuide,
    active: false,
    authorName: "",
    reviewerName: "",
    reviewedAt: "",
    sourceNotes: ""
  });
  assert.equal(guide.active, false);
  assert.equal(guide.reviewerName, "");
});
