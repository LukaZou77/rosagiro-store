import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import * as productImages from "./product-images";
import { emptyPriceAdjustment } from "./product-price-adjustment";

const moduleUrl = (path: string) => new URL(path, import.meta.url).href;
const slug = "produto-teste";
const oldImage = `/uploads/products/${slug}/anterior.png`;
const newImage = `/uploads/products/${slug}/nova.png`;
let authenticated = true;
let duplicateSlug = false;
let failTransaction = false;
let failCleanup = false;

function newCalls() {
  return {
    reads: [] as string[], uploads: [] as string[], deletions: [] as string[][],
    writes: [] as string[], revalidated: [] as string[], transactions: 0
  };
}
let calls = newCalls();

const tx = {
  product: {
    update: async () => { calls.writes.push("update product"); },
    create: async () => { calls.writes.push("create product"); return { id: "product-1", slug }; }
  },
  productSku: { aggregate: async () => ({ _sum: { quantity: null }, _count: { _all: 0 } }) },
  inventory: {
    upsert: async () => { calls.writes.push("upsert inventory"); },
    create: async () => { calls.writes.push("create inventory"); }
  }
};

mock.module(moduleUrl("./auth.ts"), { exports: {
  getAdmin: async () => authenticated ? { id: "admin-test" } : null,
  clearAdminSession: () => undefined, hashPassword: () => undefined, rememberAdminEmail: () => undefined,
  requireAdmin: () => undefined, setAdminSession: () => undefined, verifyPassword: () => undefined
} });
mock.module(moduleUrl("./db.ts"), { exports: { prisma: {
  product: { findUnique: async ({ where }: { where: { slug?: string; id?: string } }) => {
    calls.reads.push(where.slug ? "slug" : "product");
    if (where.slug) return duplicateSlug ? { id: "existing-product", deletedAt: null } : null;
    return { slug, image: oldImage, gallery: [oldImage] };
  } },
  brand: { findUnique: async () => { calls.reads.push("brand"); return { id: "brand-1" }; } },
  category: { findUnique: async () => { calls.reads.push("category"); return { id: "category-1" }; } },
  productSubcategory: { findUnique: async () => {
    calls.reads.push("subcategory");
    return { id: "subcategory-1", categoryId: "category-1", label: "Categoria" };
  } },
  $transaction: async (operation: (database: typeof tx) => Promise<unknown>) => {
    calls.transactions++;
    if (failTransaction) throw new Error("Failed transaction");
    return operation(tx);
  }
} } });
mock.module(moduleUrl("./product-price-adjustment-server.ts"), { exports: {
  createPriceAdjustmentJob: () => undefined,
  getSavedPriceAdjustmentConfig: async () => emptyPriceAdjustment
} });
mock.module(moduleUrl("./product-images.ts"), { exports: {
  ...productImages,
  saveProductImageUploads: async (productSlug: string, files: File[]) => {
    assert.equal(productSlug, slug);
    calls.uploads.push(...files.map((file) => file.name));
    return files.map(() => newImage);
  },
  deleteProductImages: async (productSlug: string, images: string[]) => {
    assert.equal(productSlug, slug);
    calls.deletions.push(images);
    if (failCleanup) throw new Error("Failed storage cleanup");
  }
} });
mock.module("next/cache", { exports: {
  revalidatePath: (path: string) => calls.revalidated.push(path),
  updateTag: () => undefined,
  unstable_cache: (fn: unknown) => fn
} });
mock.module("next/navigation", { exports: { redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } } });

const { createProductAction, updateProductDetailAction } = await import("../app/admin/actions");

beforeEach(() => {
  authenticated = true;
  duplicateSlug = false;
  failTransaction = false;
  failCleanup = false;
  calls = newCalls();
});

function productForm() {
  const form = new FormData();
  form.set("productId", "product-1");
  form.set("name", "Produto Teste");
  form.set("descriptionPt", "Descrição do produto.");
  form.set("price", "12,34");
  form.set("brandId", "brand-1");
  form.set("categoryId", "category-1");
  form.set("subcategoryId", "subcategory-1");
  form.set("quantity", "100");
  form.set("returnTo", "/admin/produtos?q=Rosa&page=3");
  form.set("galleryExisting", oldImage);
  form.set("removeGalleryImage", oldImage);
  form.set("galleryFiles", new File([new Uint8Array([1, 2, 3])], "nova.png", { type: "image/png" }));
  return form;
}

test("both product actions require an admin before reading products, uploading, or writing", async () => {
  authenticated = false;
  for (const action of [createProductAction, updateProductDetailAction]) {
    const result = await action(productForm());
    assert.equal("loginRequired" in result && result.loginRequired, true);
    assert.match(result.error, /sessão expirou/);
  }
  assert.deepEqual(calls, newCalls());
});

test("duplicate slug returns an editable error with no upload or create", async () => {
  duplicateSlug = true;
  assert.deepEqual(await createProductAction(productForm()), { error: "Este slug já existe. Use outro identificador para o produto." });
  assert.deepEqual(calls, { ...newCalls(), reads: ["slug"] });
});

test("a saved update still redirects with its filters when deleting an old image fails", async (t) => {
  failCleanup = true;
  t.mock.method(console, "error", () => undefined);
  await assert.rejects(updateProductDetailAction(productForm()), (error: Error) => {
    assert.match(error.message, /^REDIRECT:/);
    const redirect = new URL(error.message.slice("REDIRECT:".length), "https://admin.invalid");
    assert.equal(redirect.pathname, `/admin/produtos/${slug}`);
    assert.equal(redirect.searchParams.get("saved"), "1");
    assert.equal(redirect.searchParams.get("returnTo"), "/admin/produtos?q=Rosa&page=3");
    return true;
  });
  assert.equal(calls.transactions, 1);
  assert.deepEqual(calls.writes, ["update product", "upsert inventory"]);
  assert.deepEqual(calls.uploads, ["nova.png"]);
  assert.deepEqual(calls.deletions, [[oldImage]]);
  assert.ok(calls.revalidated.includes(`/produto/${slug}`));
});

test("transaction errors keep both forms editable and clean only their new uploads", async () => {
  failTransaction = true;
  assert.match((await createProductAction(productForm())).error, /Não foi possível criar o produto/);
  assert.match((await updateProductDetailAction(productForm())).error, /Não foi possível salvar o produto/);
  assert.equal(calls.transactions, 2);
  assert.deepEqual(calls.uploads, ["nova.png", "nova.png"]);
  assert.deepEqual(calls.deletions, [[newImage], [newImage]]);
  assert.deepEqual(calls.writes, []);
  assert.deepEqual(calls.revalidated, []);
});
