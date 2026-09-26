import assert from "node:assert/strict";
import test from "node:test";
import { procurementGuideArticles } from "@/lib/procurement-guide-content";
import { validateGuideArticleInput } from "@/lib/guide-article-input";
import { assessPublicationState, contentHash, expectedDraftHashes } from "@/scripts/publish-procurement-guides";

const targets = procurementGuideArticles.map((guide) => validateGuideArticleInput(guide));

function stored(target: (typeof targets)[number], overrides: Record<string, unknown> = {}) {
  return {
    ...target,
    id: `id-${target.slug}`,
    publishedAt: new Date("2026-09-26T15:00:00.000Z"),
    updatedAt: new Date("2026-09-26T15:00:00.000Z"),
    ...overrides
  };
}

test("recognizes an idempotent read-back when all reviewed guides are already published", () => {
  const rows = targets.map((guide) => stored(guide));
  const result = assessPublicationState(rows, targets);
  assert.equal(result.state, "already-published");
  assert.ok(result.guides.every((guide) => guide.currentHash === guide.targetHash));
});

test("allows only a complete set of exact expected drafts", () => {
  const drafts = targets.map((guide) => stored(guide, { active: false, publishedAt: null }));
  const draftHashes = Object.fromEntries(drafts.map((guide) => [guide.slug, contentHash(guide)]));
  const result = assessPublicationState(drafts, targets, draftHashes);
  assert.equal(result.state, "ready-to-publish");

  assert.throws(
    () => assessPublicationState(drafts.slice(1), targets, draftHashes),
    /Esperados exatamente 3 rascunhos existentes/
  );
});

test("rejects concurrent content changes and mixed draft/published state", () => {
  const drafts = targets.map((guide) => stored(guide, { active: false, publishedAt: null }));
  const draftHashes = Object.fromEntries(drafts.map((guide) => [guide.slug, contentHash(guide)]));

  assert.throws(
    () => assessPublicationState([{ ...drafts[0], title: "Edicao concorrente" }, ...drafts.slice(1)], targets, draftHashes),
    /Conteudo ou estado divergente/
  );

  assert.throws(
    () => assessPublicationState([stored(targets[0]), ...drafts.slice(1)], targets, draftHashes),
    /Estado parcial detectado/
  );
});

test("preserves the authorized draft empty reviewer instead of normalizing it to null", () => {
  const authorizedDraft = stored(targets[0], {
    active: false,
    publishedAt: null,
    reviewerName: "",
    reviewedAt: null
  });
  const nullNormalizedDraft = { ...authorizedDraft, reviewerName: null };

  assert.notEqual(contentHash(authorizedDraft), contentHash(nullNormalizedDraft));
  assert.deepEqual(expectedDraftHashes, {
    "como-montar-pedido-misto-atacado": "914db86a44067f07e2890acf6daee0b931c17d55a38cb218145c1643b7357f1f",
    "entenda-caixa-fechada-caixa-master-e-minimo-por-item": "dec65ed4c1ced351db76dcd7aabc708f7fb97a5ce9b36a84d9ab63fab9a89f7c",
    "como-funciona-frete-e-retirada-no-atacado": "1ab7049f3dba83824b6d9ecac475a4e587256faf3eddcb75e87f35323300ec7b"
  });
});
