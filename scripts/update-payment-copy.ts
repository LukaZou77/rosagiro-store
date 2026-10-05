import nextEnv from "@next/env";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { storefrontPaymentLabel, storefrontPaymentNote } from "../lib/payments";

nextEnv.loadEnvConfig(process.cwd());
const { prisma } = await import("../lib/db-client");
const apply = process.argv.includes("--apply");
const oldPaymentNote = "Os pagamentos podem ser feitos por Pix ou cartão via Mercado Pago, conforme opções disponíveis no checkout. Condições de parcelamento, análise, aprovação, recusa, estorno e confirmação final seguem as regras do Mercado Pago e do emissor do cartão.";
const oldPrivacySentence = "Pagamentos via Pix ou cartão podem ser processados pelo Mercado Pago.";
const newPrivacySentence = "Pagamentos são feitos por Pix ou transferência bancária, com confirmação pelo atendimento.";

try {
  const profile = await prisma.storeProfile.findUniqueOrThrow({
    where: { id: "main" },
    select: { storeName: true, paymentNote: true, trustBadges: true, updatedAt: true }
  });
  assert.equal(profile.storeName, "RosaGiro");
  assert.ok([oldPaymentNote, storefrontPaymentNote].includes(profile.paymentNote), "Payment note changed; review before applying.");
  assert.ok(Array.isArray(profile.trustBadges));
  const trustBadges = profile.trustBadges.map((badge) => badge === "Pix e cartão via Mercado Pago" ? storefrontPaymentLabel : badge);
  const pages = await prisma.siteInfoPage.findMany({
    where: { pageKey: { in: ["terms", "privacy"] } },
    select: { pageKey: true, sections: true, updatedAt: true }
  });
  assert.equal(pages.length, 2);
  const updates = pages.map((page) => {
    assert.ok(Array.isArray(page.sections));
    let matched = false;
    const sections = page.sections.map((value) => {
      assert.ok(value && typeof value === "object" && !Array.isArray(value));
      const section = value as { title: string; body: string };
      if (page.pageKey === "terms" && section.title === "Pagamento") {
        assert.ok([oldPaymentNote, storefrontPaymentNote].includes(section.body), "Terms payment text changed; review before applying.");
        matched = true;
        return { ...section, body: storefrontPaymentNote };
      }
      if (page.pageKey === "privacy" && section.title === "Pagamentos e parceiros operacionais") {
        assert.ok(section.body.startsWith(oldPrivacySentence) || section.body.startsWith(newPrivacySentence), "Privacy payment text changed; review before applying.");
        matched = true;
        return { ...section, body: section.body.replace(oldPrivacySentence, newPrivacySentence) };
      }
      return section;
    });
    assert.ok(matched, `Missing payment section: ${page.pageKey}`);
    return { ...page, sections };
  });

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", paymentNote: storefrontPaymentNote, trustBadges, changedSections: updates.map((page) => ({ pageKey: page.pageKey, sections: page.sections.filter((section) => section.body.includes(storefrontPaymentNote) || section.body.startsWith(newPrivacySentence)) })) }, null, 2));

  if (apply) {
    const backupDir = path.join(process.cwd(), "output", "payment-copy");
    await mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `before-${Date.now()}.json`);
    await writeFile(backupPath, JSON.stringify({ profile, pages }, null, 2));
    await prisma.$transaction(async (tx) => {
      const result = await tx.storeProfile.updateMany({
        where: { id: "main", updatedAt: profile.updatedAt },
        data: { paymentNote: storefrontPaymentNote, trustBadges }
      });
      assert.equal(result.count, 1, "Store profile changed concurrently.");
      for (const page of updates) {
        const result = await tx.siteInfoPage.updateMany({
          where: { pageKey: page.pageKey, updatedAt: page.updatedAt },
          data: { sections: page.sections }
        });
        assert.equal(result.count, 1, "Policy page changed concurrently.");
      }
    });
    const savedProfile = await prisma.storeProfile.findUniqueOrThrow({ where: { id: "main" }, select: { paymentNote: true, trustBadges: true } });
    assert.equal(savedProfile.paymentNote, storefrontPaymentNote);
    assert.deepEqual(savedProfile.trustBadges, trustBadges);
    for (const page of updates) {
      const saved = await prisma.siteInfoPage.findUniqueOrThrow({ where: { pageKey: page.pageKey }, select: { sections: true } });
      assert.deepEqual(saved.sections, page.sections);
    }
    console.log(JSON.stringify({ status: "applied-and-read-back", backupPath }));
  }
} finally {
  await prisma.$disconnect();
}
