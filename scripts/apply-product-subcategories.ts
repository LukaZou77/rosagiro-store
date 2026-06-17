import { existsSync, readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveBodyAreaCategorySlug } from "../lib/category-taxonomy";
import { findSeedSubcategoryLabel, productSubcategorySeeds, subcategorySlug } from "../lib/product-subcategories";

const envLocal = ".env.local";
if (existsSync(envLocal)) {
  for (const line of readFileSync(envLocal, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to apply product subcategories.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

async function seedDefaultSubcategories() {
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true }
  });
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
  let createdOrUpdated = 0;

  for (const group of productSubcategorySeeds) {
    const category = categoryBySlug.get(group.categorySlug);
    if (!category) continue;

    for (const [index, label] of group.labels.entries()) {
      await prisma.productSubcategory.upsert({
        where: {
          categoryId_slug: {
            categoryId: category.id,
            slug: subcategorySlug(label)
          }
        },
        update: {
          label,
          sortOrder: (index + 1) * 10
        },
        create: {
          categoryId: category.id,
          slug: subcategorySlug(label),
          label,
          sortOrder: (index + 1) * 10
        }
      });
      createdOrUpdated += 1;
    }
  }

  return createdOrUpdated;
}

async function ensureProductSubcategory(categoryId: string, label: string, sortOrder = 1000) {
  return prisma.productSubcategory.upsert({
    where: {
      categoryId_slug: {
        categoryId,
        slug: subcategorySlug(label)
      }
    },
    update: {
      label
    },
    create: {
      categoryId,
      slug: subcategorySlug(label),
      label,
      sortOrder
    }
  });
}

async function linkExistingProducts() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      subcategory: true,
      subcategoryId: true,
      category: { select: { id: true, slug: true, label: true } }
    }
  });
  let linked = 0;

  for (const product of products) {
    if (product.subcategoryId) continue;

    const categorySlug = resolveBodyAreaCategorySlug({
      categorySlug: product.category.slug,
      categoryLabel: product.category.label,
      subcategory: product.subcategory,
      name: product.name
    });
    const category =
      categorySlug === product.category.slug
        ? product.category
        : await prisma.category.findUnique({
            where: { slug: categorySlug },
            select: { id: true, slug: true, label: true }
          });

    if (!category) continue;

    const label = findSeedSubcategoryLabel(category.slug, product.subcategory) || product.subcategory.trim();
    if (!label) continue;

    const subcategory = await ensureProductSubcategory(category.id, label);
    await prisma.product.update({
      where: { id: product.id },
      data: {
        subcategoryId: subcategory.id,
        subcategory: subcategory.label
      }
    });
    linked += 1;
  }

  return linked;
}

async function main() {
  const seeded = await seedDefaultSubcategories();
  const linked = await linkExistingProducts();
  console.log(`Product subcategories ready. Seeded or updated: ${seeded}. Linked products: ${linked}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
