import assert from "node:assert/strict";
import test from "node:test";
import { validateGuideArticleInput } from "@/lib/guide-article-input";
import { procurementGuideArticles } from "@/lib/procurement-guide-content";

test("procurement guides identify RosaGiro as the editorially responsible organization", () => {
  assert.equal(procurementGuideArticles.length, 3);
  assert.equal(new Set(procurementGuideArticles.map((guide) => guide.slug)).size, procurementGuideArticles.length);

  for (const guide of procurementGuideArticles) {
    const validated = validateGuideArticleInput(guide);
    assert.equal(validated.active, true);
    assert.equal(validated.coverImage, "/assets/rosagiro-atacado-hero.webp");
    assert.ok(validated.body.includes("\n\n"));
    assert.equal(validated.reviewerName, "RosaGiro");
    assert.equal(validated.reviewedAt?.toISOString(), "2026-09-26T12:00:00.000Z");
    assert.match(validated.sourceNotes, /Configuração vigente da RosaGiro conferida/);
    assert.match(validated.sourceNotes, /26\/09\/2026/);
    assert.doesNotMatch(`${validated.reviewerName}\n${validated.sourceNotes}`, /IA|Codex/i);
  }
});

test("procurement guides keep purchase terms scoped to the applicable item or quote", () => {
  const content = procurementGuideArticles.map((guide) => guide.body).join("\n");
  assert.match(content, /R\$ 500,00/);
  assert.match(content, /marcas diferentes/);
  assert.match(content, /frete não entra nesse mínimo/);
  assert.match(content, /Não existe uma quantidade universal/);
  assert.match(content, /reunir unidades ou caixas menores/);
  assert.match(content, /não podem ser escolhidas separadamente/);
  assert.match(content, /pagamento feito no site inclui somente os produtos/);
  assert.match(content, /peso e nas dimensões reais do pacote/);
  assert.match(content, /cobrança separada, fora do site/);
  assert.match(content, /LA BELLA, Rua Paula Sousa, 529, Box A01/);
  assert.match(content, /agendamento e confirmação pelo WhatsApp/);
  assert.doesNotMatch(content, /Antes do pagamento, confira o serviço de entrega/);
});
