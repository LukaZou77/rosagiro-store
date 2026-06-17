import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { BODY_AREA_CATEGORIES, LEGACY_CATEGORY_SLUGS, resolveBodyAreaCategorySlug } from "../lib/category-taxonomy";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

async function main() {
  const categoryRecords = new Map<string, { id: string }>();

  for (const category of BODY_AREA_CATEGORIES) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category
    });
    categoryRecords.set(category.slug, record);
  }

  const legacyProducts = await prisma.product.findMany({
    where: { category: { slug: { in: [...LEGACY_CATEGORY_SLUGS] } } },
    select: {
      id: true,
      name: true,
      subcategory: true,
      category: { select: { slug: true, label: true } }
    }
  });

  let migrated = 0;
  for (const product of legacyProducts) {
    const targetSlug = resolveBodyAreaCategorySlug({
      categorySlug: product.category.slug,
      categoryLabel: product.category.label,
      subcategory: product.subcategory,
      name: product.name
    });
    const targetCategory = categoryRecords.get(targetSlug);
    if (!targetCategory) continue;

    await prisma.product.update({
      where: { id: product.id },
      data: { categoryId: targetCategory.id }
    });
    migrated += 1;
  }

  const deleted = await prisma.category.deleteMany({
    where: {
      slug: { in: [...LEGACY_CATEGORY_SLUGS] },
      products: { none: {} }
    }
  });

  console.log(`Body-area categories ready. Migrated ${migrated} products and removed ${deleted.count} empty legacy categories.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
