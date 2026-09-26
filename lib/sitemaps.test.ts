import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const alias = "paleta-de-sombra-glitter-12-cores-vivai-2172-1-1";
const canonical = "vivai-estojo-de-glitter-12-cores-2172-1-1";
const rows = [
  { slug: alias, descriptionPt: "Wholesale terms", active: true, updatedAt: new Date(0), priceCents: 670, baseBoxPieces: 24, baseBoxPriceCents: 16080, brand: { name: "ViVai" } },
  { slug: canonical, descriptionPt: "", active: true, updatedAt: new Date(0), priceCents: 670, baseBoxPieces: 24, baseBoxPriceCents: 16080, brand: { name: "ViVai" } }
];

mock.module(pathToFileURL(resolve(import.meta.dirname, "db.ts")).href, {
  namedExports: {
    prisma: {
      product: {
        findMany: async (query: { where: { OR?: Array<{ slug?: { in: string[] } }> } }) => {
          const explicitSlugs = query.where.OR?.flatMap((filter) => filter.slug?.in || []) || [];
          return rows.filter((row) => row.descriptionPt || explicitSlugs.includes(row.slug));
        }
      }
    }
  }
});

const { productSitemapEntries } = await import("./sitemaps");

test("includes the verified canonical source page even without a legacy description", async () => {
  const entries = await productSitemapEntries();
  assert.equal(entries.length, 1);
  assert.ok(entries[0].url.endsWith(`/produto/${canonical}`));
  assert.ok(!entries.some((entry) => entry.url.endsWith(`/produto/${alias}`)));
});
