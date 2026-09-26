import assert from "node:assert/strict";
import test from "node:test";
import { validateGuideArticleInput } from "@/lib/guide-article-input";
import { procurementGuideArticles } from "@/lib/procurement-guide-content";

test("procurement guides are original plain-text drafts without claimed human review", () => {
  assert.equal(procurementGuideArticles.length, 3);
  assert.equal(new Set(procurementGuideArticles.map((guide) => guide.slug)).size, procurementGuideArticles.length);

  for (const guide of procurementGuideArticles) {
    const validated = validateGuideArticleInput(guide);
    assert.equal(validated.active, false);
    assert.equal(validated.coverImage, "/assets/rosagiro-atacado-hero.webp");
    assert.ok(validated.body.includes("\n\n"));
    assert.equal(validated.reviewerName, "");
    assert.equal(validated.reviewedAt, null);
  }
});

test("procurement guides keep purchase terms scoped to the applicable item or quote", () => {
  const content = procurementGuideArticles.map((guide) => guide.body).join("\n");
  assert.match(content, /R\$ 500,00/);
  assert.match(content, /Não existe uma quantidade universal/);
  assert.match(content, /reúne unidades ou embalagens menores/);
  assert.match(content, /geralmente não podem ser escolhidas separadamente/);
  assert.match(content, /pagamento no site inclui somente os produtos/);
  assert.match(content, /peso e nas dimensões reais do pacote/);
  assert.match(content, /cobrado separadamente pelo atendimento, fora do site/);
  assert.doesNotMatch(content, /Antes do pagamento, confira o serviço de entrega/);
});
