import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync(new URL("../app/admin/actions.ts", import.meta.url), "utf8");

test("manual catalogue refresh authenticates before invalidation and never writes data", () => {
  const body = actions.match(/export async function refreshCatalogAction\(\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.ok(body.indexOf("await requireAdmin()") >= 0);
  assert.ok(body.indexOf("await requireAdmin()") < body.indexOf("revalidateCatalog()"));
  assert.ok(!/prisma\.|importProducts|saveProduct/.test(body));
});

test("successful CSV import invalidates the same storefront tag as product edits", () => {
  const body = actions.split("export async function importProductsAction")[1]?.split("export async function")[0] || "";
  assert.match(body, /await importProductsFromCsv\(csvText\);\s+revalidateCatalog\(\);/);
  const invalidation = actions.split("function revalidateCatalog(")[1]?.split("function revalidateCategoryManagement")[0] || "";
  assert.match(invalidation, /updateTag\(STOREFRONT_CATALOG_CACHE_TAG\)/);
  for (const route of ["/marcas", "/marcas/[slug]", "/produto/[slug]", "/categoria/[slug]"]) {
    assert.ok(invalidation.includes(`"${route}"`));
  }
});
