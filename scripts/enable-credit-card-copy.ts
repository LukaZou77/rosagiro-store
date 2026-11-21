import nextEnv from "@next/env";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { storefrontPaymentLabel, storefrontPaymentNote } from "../lib/payments";

nextEnv.loadEnvConfig(process.cwd());
const { prisma } = await import("../lib/db-client");
const apply = process.argv.includes("--apply");
const previousNote = "Aceitamos Pix e transferência bancária. Antes de pagar, aguarde a confirmação do estoque e dos dados de pagamento pelo atendimento no WhatsApp.";
const previousPrivacy = "Pagamentos são feitos por Pix ou transferência bancária, com confirmação pelo atendimento.";
const currentPrivacy = "Pagamentos via Pix ou cartão de crédito com parcelamento são processados pelo Mercado Pago. Transferências bancárias são confirmadas pelo atendimento.";

try {
  const profile = await prisma.storeProfile.findUniqueOrThrow({
    where: { id: "main" },
    select: { storeName: true, paymentNote: true, trustBadges: true, updatedAt: true }
  });
  assert.equal(profile.storeName, "RosaGiro");
  assert.ok([previousNote, storefrontPaymentNote].includes(profile.paymentNote), "Payment note changed; review before updating.");
  assert.ok(Array.isArray(profile.trustBadges));
  const trustBadges = profile.trustBadges.map((badge) => badge === "Pix e transferência bancária" ? storefrontPaymentLabel : badge);
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
        assert.ok([previousNote, storefrontPaymentNote].includes(section.body), "Terms changed; review before updating.");
        matched = true;
        return { ...section, body: storefrontPaymentNote };
      }
      if (page.pageKey === "privacy" && section.title === "Pagamentos e parceiros operacionais") {
        assert.ok(section.body.startsWith(previousPrivacy) || section.body.startsWith(currentPrivacy), "Privacy text changed; review before updating.");
        matched = true;
        return { ...section, body: section.body.replace(previousPrivacy, currentPrivacy) };
      }
      return section;
    });
    assert.ok(matched, `Missing payment section in ${page.pageKey}.`);
    return { ...page, sections };
  });
  console.log(JSON.stringify({ mode: apply ? "apply" : "preview", paymentNote: storefrontPaymentNote, paymentBadge: storefrontPaymentLabel, updatedPages: updates.map((page) => page.pageKey) }));
  if (apply) {
    const backupDir = path.join(process.cwd(), "output", "credit-card-release-2026-11-21");
    await mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `payment-copy-before-${Date.now()}.json`);
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
    const saved = await prisma.storeProfile.findUniqueOrThrow({ where: { id: "main" }, select: { paymentNote: true, trustBadges: true } });
    assert.equal(saved.paymentNote, storefrontPaymentNote);
    assert.deepEqual(saved.trustBadges, trustBadges);
    for (const page of updates) {
      const savedPage = await prisma.siteInfoPage.findUniqueOrThrow({ where: { pageKey: page.pageKey }, select: { sections: true } });
      assert.deepEqual(savedPage.sections, page.sections);
    }
    console.log(JSON.stringify({ status: "applied-and-read-back", backupPath }));
  }
} finally {
  await prisma.$disconnect();
}
