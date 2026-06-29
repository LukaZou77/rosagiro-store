"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAdminSession, requireAdmin, setAdminSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { brlInputToCents } from "@/lib/money";
import { markOrderPaid, OrderError } from "@/lib/orders";
import { isMercadoPagoInstallments } from "@/lib/payments";
import { importProductsFromCsv, ProductImportError } from "@/lib/product-import";
import {
  adjustPriceCents,
  buildAdjustedProductPricing,
  parsePriceAdjustmentInput
} from "@/lib/product-price-adjustment";
import { getSavedPriceAdjustmentConfig, saveAndApplyPriceAdjustment } from "@/lib/product-price-adjustment-server";
import { isAllowedProductImage, normalizeProductGallery, parseCents, parsePipeList, slugify } from "@/lib/product-import-shared";
import { subcategorySlug } from "@/lib/product-subcategories";
import {
  assertGalleryCapacity,
  cleanGalleryInput,
  deleteProductImages,
  extractProductUploads,
  saveProductImageUploads
} from "@/lib/product-images";
import { INTERNAL_AVAILABLE_STOCK_QUANTITY, stockQuantityFromAvailability } from "@/lib/product-stock";
import { formatCep } from "@/lib/cep";
import { pixAccountTypeOptions, pixKeyTypeOptions, STORE_PROFILE_ID } from "@/lib/store-profile";
import { SiteInfoPageValidationError, validateSiteInfoPageInput } from "@/lib/site-info-pages";
import type { Prisma } from "@/src/generated/prisma/client";

const statuses = ["PENDING_PAYMENT", "PAID", "FULFILLING", "SHIPPED", "CANCELED"] as const;
const launchReadinessStatuses = ["PENDING", "IN_PROGRESS", "DONE", "BLOCKED"] as const;

function field(formData: FormData, name: string) {
  return String(formData.get(name) || "").trim();
}

function positiveInt(formData: FormData, name: string, fallback = 0) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function nullableField(formData: FormData, name: string) {
  return field(formData, name) || null;
}

function ratingValue(formData: FormData) {
  const raw = field(formData, "rating");
  if (!raw) return 0;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value)) return 0;
  return Math.min(5, Math.max(0, value));
}

function redirectError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function selectedProductIds(formData: FormData) {
  return Array.from(
    new Set(
      formData
        .getAll("productIds")
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function cleanState(value: string) {
  return value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase();
}

function optionalHttpUrl(value: string, fieldLabel: string) {
  if (!value) return "";

  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    // Fall through to the shared error below.
  }

  redirectError("/admin/loja", `${fieldLabel} deve ser uma URL http(s) válida.`);
}

function includesOption(options: readonly { value: string }[], value: string) {
  return options.some((option) => option.value === value);
}

function validatePixKey(type: string, key: string) {
  if (!key) return false;
  if (type === "CPF") return onlyDigits(key).length === 11;
  if (type === "CNPJ") return onlyDigits(key).length === 14;
  if (type === "EMAIL") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key);
  if (type === "PHONE") return onlyDigits(key).length >= 10;
  return key.length >= 8;
}

function revalidateCatalog(productSlug?: string) {
  revalidatePath("/");
  revalidatePath("/promocoes");
  revalidatePath("/categoria/[slug]", "page");
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
  revalidatePath("/admin");
  revalidatePath("/admin/produtos");
  revalidatePath("/admin/produtos/lixeira");
  revalidatePath("/admin/produtos/qualidade");
  revalidatePath("/admin/importar-produtos");
  revalidatePath("/admin/prontidao");
  if (productSlug) revalidatePath(`/produto/${productSlug}`);
}

function revalidateCategoryManagement() {
  revalidateCatalog();
  revalidatePath("/admin/categorias");
}

export async function saveProductPriceAdjustmentAction(formData: FormData) {
  await requireAdmin();

  const config = parsePriceAdjustmentInput({
    direction: field(formData, "priceAdjustmentDirection"),
    type: field(formData, "priceAdjustmentType"),
    value: field(formData, "priceAdjustmentValue")
  });
  const confirmation = field(formData, "confirmPriceAdjustment").toUpperCase();

  if (config.direction === "none" || config.value <= 0) {
    redirectError("/admin/produtos", "Informe um ajuste de preço válido antes de aplicar.");
  }
  if (confirmation !== "APLICAR") {
    redirectError("/admin/produtos", "Digite APLICAR para confirmar o ajuste global de preços.");
  }

  const summary = await saveAndApplyPriceAdjustment(config);
  revalidateCatalog();

  const params = new URLSearchParams({
    priceAdjusted: String(summary.productCount),
    priceAdjustedSkus: String(summary.skuCount),
    priceSkipped: String(summary.skippedProductCount + summary.skippedSkuCount),
    priceWarnings: String(summary.descriptionWarningCount)
  });
  redirect(`/admin/produtos?${params.toString()}`);
}

type ProductFormPreparationOptions = {
  detailPath: string;
  productSlug: string;
  existingImage?: string;
  existingGallery?: string[];
  existingSuggestedQuantity?: number | null;
  existingKitRecommendation?: string | null;
  existingBaseBoxPriceCents?: number | null;
  existingBaseBoxPieces?: number | null;
};

type ProductSkuInput = {
  id?: string;
  name: string;
  code: string;
  image: string | null;
  priceCents: number | null;
  basePriceCents: number | null;
  quantity: number;
  active: boolean;
  sortOrder: number;
};

function optionalPositiveInt(formData: FormData, key: string) {
  const raw = field(formData, key);
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function parseProductSkuInputs(formData: FormData, detailPath: string) {
  const rowKeys = Array.from(new Set(formData.getAll("skuRowKey").map((value) => String(value || "").trim()).filter(Boolean)));
  const deletedIds = Array.from(new Set(formData.getAll("skuDeleteId").map((value) => String(value || "").trim()).filter(Boolean)));
  const rows: ProductSkuInput[] = [];
  const codeKeys = new Set<string>();

  for (const [index, rowKey] of rowKeys.entries()) {
    const id = field(formData, `skuId:${rowKey}`);
    const name = field(formData, `skuName:${rowKey}`);
    const code = field(formData, `skuCode:${rowKey}`);
    const image = field(formData, `skuImage:${rowKey}`);
    const priceCents = parseCents(field(formData, `skuPrice:${rowKey}`));
    const quantityRaw = field(formData, `skuQuantity:${rowKey}`);
    const sortRaw = field(formData, `skuSortOrder:${rowKey}`);
    const quantityValue = Number(quantityRaw.replace(",", "."));
    const availabilityQuantity = quantityRaw === "in" || quantityRaw === "out" ? stockQuantityFromAvailability(quantityRaw) : null;
    const hasAnyValue = Boolean(id || name || code || image || priceCents > 0 || (Number.isFinite(quantityValue) && quantityValue > 0));

    if (!hasAnyValue) continue;
    if (!name || !code) redirectError(detailPath, "Preencha nome e código de todas as variações SKU.");
    if (image && !isAllowedProductImage(image)) {
      redirectError(detailPath, "A imagem do SKU deve usar /assets/..., /uploads/products/..., /placeholder... ou URL http(s).");
    }

    const quantity =
      availabilityQuantity ??
      (quantityRaw ? Math.max(0, Math.floor(quantityValue || 0)) : INTERNAL_AVAILABLE_STOCK_QUANTITY);
    const sortOrder = Number.isFinite(Number(sortRaw)) ? Math.max(0, Math.floor(Number(sortRaw))) : index * 10;
    const codeKey = code.toLowerCase();
    if (codeKeys.has(codeKey)) redirectError(detailPath, "Cada SKU precisa ter um código único dentro do produto.");
    codeKeys.add(codeKey);

    rows.push({
      id: id || undefined,
      name: name.slice(0, 120),
      code: code.slice(0, 80),
      image: image || null,
      priceCents: null,
      basePriceCents: priceCents > 0 ? priceCents : null,
      quantity,
      active: formData.get(`skuActive:${rowKey}`) === "on",
      sortOrder
    });
  }

  return { rows, deletedIds };
}

async function syncProductSkus(
  tx: Prisma.TransactionClient,
  productId: string,
  skus: ProductSkuInput[],
  deletedIds: string[]
) {
  if (deletedIds.length) {
    await tx.productSku.deleteMany({ where: { productId, id: { in: deletedIds } } });
  }

  for (const sku of skus) {
    const data = {
      name: sku.name,
      code: sku.code,
      image: sku.image,
      priceCents: sku.priceCents,
      basePriceCents: sku.basePriceCents,
      quantity: sku.quantity,
      active: sku.active,
      sortOrder: sku.sortOrder
    };
    if (sku.id) {
      await tx.productSku.updateMany({ where: { id: sku.id, productId }, data });
    } else {
      await tx.productSku.create({ data: { productId, ...data } });
    }
  }
}

async function activeSkuStock(tx: Prisma.TransactionClient, productId: string) {
  const aggregate = await tx.productSku.aggregate({
    where: { productId, active: true },
    _sum: { quantity: true },
    _count: { _all: true }
  });
  return {
    hasActiveSkus: aggregate._count._all > 0,
    quantity: aggregate._sum.quantity || 0
  };
}

async function prepareProductFormPayload(formData: FormData, options: ProductFormPreparationOptions) {
  const name = field(formData, "name");
  const brandId = field(formData, "brandId");
  const categoryId = field(formData, "categoryId");
  const subcategoryId = field(formData, "subcategoryId");
  const descriptionPt = field(formData, "descriptionPt");
  const image = field(formData, "image");
  const primaryImageInput = field(formData, "primaryImage");
  const priceCents = parseCents(field(formData, "price"));
  const quantity = positiveInt(formData, "quantity");
  const weightGrams = optionalPositiveInt(formData, "weightGrams");
  const reviewCount = positiveInt(formData, "reviewCount");
  const featuredRank = positiveInt(formData, "featuredRank", 1000);
  const active = formData.get("active") === "on";
  const skuInput = parseProductSkuInputs(formData, options.detailPath);

  if (!name || !brandId || !categoryId || !subcategoryId || !descriptionPt || priceCents <= 0) {
    redirectError(options.detailPath, "Preencha os campos obrigatórios do produto.");
  }
  if (image && !isAllowedProductImage(image)) {
    redirectError(options.detailPath, "A imagem deve usar /assets/..., /uploads/products/..., /placeholder... ou URL http(s).");
  }

  const [brand, category, subcategory] = await Promise.all([
    prisma.brand.findUnique({ where: { id: brandId } }),
    prisma.category.findUnique({ where: { id: categoryId } }),
    prisma.productSubcategory.findUnique({ where: { id: subcategoryId } })
  ]);
  if (!brand || !category) redirectError(options.detailPath, "Marca ou categoria inválida.");

  if (!subcategory || subcategory.categoryId !== category.id) {
    redirectError(options.detailPath, "Selecione uma subcategoria válida para a categoria escolhida.");
  }

  const priceAdjustment = await getSavedPriceAdjustmentConfig();
  const adjustedPricing = buildAdjustedProductPricing({
    basePriceCents: priceCents,
    descriptionPt,
    config: priceAdjustment,
    baseBoxPriceCents: options.existingBaseBoxPriceCents,
    baseBoxPieces: options.existingBaseBoxPieces
  });
  if (!adjustedPricing.ok) redirectError(options.detailPath, adjustedPricing.reason);

  const adjustedSkus = skuInput.rows.map((sku) => {
    if (!sku.basePriceCents) return sku;
    const adjustedSkuPrice = adjustPriceCents(sku.basePriceCents, priceAdjustment);
    if (!adjustedSkuPrice) {
      redirectError(options.detailPath, `O ajuste deixaria o preço do SKU ${sku.code} abaixo de R$ 0,01.`);
    }
    return { ...sku, priceCents: adjustedSkuPrice };
  });

  const existingGallery = normalizeProductGallery(options.existingImage || "", options.existingGallery || []);
  const removedImages = new Set(cleanGalleryInput(formData.getAll("removeGalleryImage")));
  const keptExistingImages = cleanGalleryInput(formData.getAll("galleryExisting"))
    .filter((galleryImage) => existingGallery.includes(galleryImage))
    .filter((galleryImage) => !removedImages.has(galleryImage));
  const manualImages = image ? [image] : [];
  const baseGallery = normalizeProductGallery(
    "",
    [...manualImages, ...keptExistingImages].filter((galleryImage) => !removedImages.has(galleryImage))
  );
  const uploadFiles = extractProductUploads(formData.getAll("galleryFiles"));
  let uploadedImages: string[] = [];

  try {
    assertGalleryCapacity(baseGallery, uploadFiles.length);
    uploadedImages = await saveProductImageUploads(options.productSlug, uploadFiles);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível salvar as imagens enviadas.";
    redirectError(options.detailPath, message);
  }

  const gallery = normalizeProductGallery("", [...baseGallery, ...uploadedImages]);
  if (!gallery.length) redirectError(options.detailPath, "Cadastre pelo menos uma imagem do produto.");

  const firstUploadAsPrimary = formData.get("firstUploadAsPrimary") === "on";
  const primaryUploadIndexInput = field(formData, "primaryUploadIndex");
  const primaryUploadIndex = primaryUploadIndexInput ? positiveInt(formData, "primaryUploadIndex") : -1;
  const preferredUploadedImage = primaryUploadIndex >= 0 ? uploadedImages[primaryUploadIndex] : null;
  const preferredPrimary = preferredUploadedImage || (firstUploadAsPrimary && uploadedImages[0] ? uploadedImages[0] : primaryImageInput);
  const primaryImage = gallery.includes(preferredPrimary)
    ? preferredPrimary
    : image && gallery.includes(image)
      ? image
      : gallery[0];

  return {
    data: {
      name,
      brandId,
      categoryId,
      subcategoryId: subcategory.id,
      subcategory: subcategory.label,
      priceCents: adjustedPricing.priceCents,
      basePriceCents: priceCents,
      baseBoxPriceCents: adjustedPricing.baseBoxPriceCents,
      baseBoxPieces: adjustedPricing.baseBoxPieces,
      compareAtPriceCents: null,
      image: primaryImage,
      gallery,
      descriptionPt: adjustedPricing.descriptionPt,
      benefits: parsePipeList(field(formData, "benefits")),
      ingredients: parsePipeList(field(formData, "ingredients")),
      badges: parsePipeList(field(formData, "badges")),
      skinType: field(formData, "skinType"),
      finish: field(formData, "finish"),
      volume: field(formData, "volume"),
      weightGrams,
      suggestedQuantity: options.existingSuggestedQuantity ?? null,
      kitRecommendation: options.existingKitRecommendation ?? null,
      wholesalePackage: nullableField(formData, "wholesalePackage"),
      validityNote: nullableField(formData, "validityNote"),
      purchaseNote: nullableField(formData, "purchaseNote"),
      rating: ratingValue(formData),
      reviewCount,
      stockStatus: quantity > 0 ? "Em estoque" : "Sem estoque",
      active,
      featuredRank
    },
    quantity,
    skus: adjustedSkus,
    deletedSkuIds: skuInput.deletedIds,
    gallery,
    uploadedImages,
    removedImages: [...removedImages]
  };
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const user = await prisma.adminUser.findFirst({ where: { email, active: true } });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect("/admin/login?error=1");
  }

  await setAdminSession(user.id);
  redirect("/admin");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/admin/login");
}

export async function updateProductAction(formData: FormData) {
  await requireAdmin();

  const productId = String(formData.get("productId") || "");
  const name = String(formData.get("name") || "").trim();
  const categoryId = String(formData.get("categoryId") || "").trim();
  const subcategoryId = String(formData.get("subcategoryId") || "").trim();
  const descriptionPt = String(formData.get("descriptionPt") || "").trim();
  const priceCents = brlInputToCents(formData.get("price"));
  const quantity = Math.max(0, Number(formData.get("quantity")) || 0);
  const active = formData.get("active") === "on";

  if (!productId || !name || !categoryId || !subcategoryId || !descriptionPt || priceCents <= 0) {
    redirect("/admin/produtos?error=1");
  }
  const subcategory = await prisma.productSubcategory.findUnique({ where: { id: subcategoryId } });
  if (!subcategory || subcategory.categoryId !== categoryId) redirect("/admin/produtos?error=1");

  await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: {
        name,
        categoryId,
        subcategoryId: subcategory.id,
        subcategory: subcategory.label,
        descriptionPt,
        priceCents,
        compareAtPriceCents: null,
        active,
        stockStatus: quantity > 0 ? "Em estoque" : "Sem estoque"
      }
    }),
    prisma.inventory.upsert({
      where: { productId },
      update: { quantity },
      create: { productId, quantity }
    })
  ]);

  revalidatePath("/");
  revalidatePath("/categoria/[slug]", "page");
  revalidatePath("/admin/produtos");
}

export async function updateProductDetailAction(formData: FormData) {
  await requireAdmin();

  const productId = field(formData, "productId");
  const product = productId
    ? await prisma.product.findUnique({
        where: { id: productId },
        select: {
          slug: true,
          image: true,
          gallery: true,
          suggestedQuantity: true,
          kitRecommendation: true,
          baseBoxPriceCents: true,
          baseBoxPieces: true
        }
      })
    : null;
  if (!product) redirectError("/admin/produtos", "Produto não encontrado.");

  const detailPath = `/admin/produtos/${product.slug}`;
  const prepared = await prepareProductFormPayload(formData, {
    detailPath,
    productSlug: product.slug,
    existingImage: product.image,
    existingGallery: product.gallery,
    existingSuggestedQuantity: product.suggestedQuantity,
    existingKitRecommendation: product.kitRecommendation,
    existingBaseBoxPriceCents: product.baseBoxPriceCents,
    existingBaseBoxPieces: product.baseBoxPieces
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: prepared.data
      });

      await syncProductSkus(tx, productId, prepared.skus, prepared.deletedSkuIds);
      const skuStock = await activeSkuStock(tx, productId);
      const inventoryQuantity = prepared.skus.length ? skuStock.quantity : prepared.quantity;

      await tx.inventory.upsert({
        where: { productId },
        update: { quantity: inventoryQuantity },
        create: { productId, quantity: inventoryQuantity }
      });
    });
  } catch {
    await deleteProductImages(product.slug, prepared.uploadedImages);
    redirectError(detailPath, "Não foi possível salvar o produto. Tente novamente.");
  }

  await deleteProductImages(product.slug, prepared.removedImages.filter((galleryImage) => !prepared.gallery.includes(galleryImage)));
  revalidateCatalog(product.slug);
  redirect(`${detailPath}?saved=1`);
}

export async function createProductAction(formData: FormData) {
  await requireAdmin();

  const name = field(formData, "name");
  const requestedSlug = field(formData, "slug");
  const slug = slugify(requestedSlug || name);
  const detailPath = "/admin/produtos/novo";

  if (!name || !slug) redirectError(detailPath, "Informe o nome do produto para gerar o slug.");
  const existingProduct = await prisma.product.findUnique({ where: { slug }, select: { id: true, deletedAt: true } });
  if (existingProduct?.deletedAt) {
    redirectError(detailPath, "Este slug está na lixeira. Restaure o produto antes de usar o mesmo identificador.");
  }
  if (existingProduct) redirectError(detailPath, "Este slug já existe. Use outro identificador para o produto.");

  const prepared = await prepareProductFormPayload(formData, {
    detailPath,
    productSlug: slug,
  });

  let product: { slug: string };
  try {
    product = await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          slug,
          ...prepared.data
        },
        select: { id: true, slug: true }
      });

      await syncProductSkus(tx, createdProduct.id, prepared.skus, []);
      const skuStock = await activeSkuStock(tx, createdProduct.id);
      const inventoryQuantity = prepared.skus.length ? skuStock.quantity : prepared.quantity;

      await tx.inventory.create({
        data: { productId: createdProduct.id, quantity: inventoryQuantity }
      });

      return createdProduct;
    });
  } catch {
    await deleteProductImages(slug, prepared.uploadedImages);
    redirectError(detailPath, "Não foi possível criar o produto. Verifique os dados e tente novamente.");
  }

  revalidateCatalog(product.slug);
  redirect(`/admin/produtos/${product.slug}?saved=1`);
}

export async function moveProductsToTrashAction(formData: FormData) {
  const admin = await requireAdmin();
  const ids = selectedProductIds(formData);
  if (!ids.length) redirectError("/admin/produtos", "Selecione pelo menos um produto para mover para a lixeira.");

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, slug: true }
  });
  if (!products.length) redirectError("/admin/produtos", "Nenhum produto disponível para mover para a lixeira.");

  const deleteNote = field(formData, "deleteNote").slice(0, 240);
  await prisma.product.updateMany({
    where: { id: { in: products.map((product) => product.id) }, deletedAt: null },
    data: {
      active: false,
      deletedAt: new Date(),
      deletedByAdminEmail: admin.email,
      deleteNote: deleteNote || null
    }
  });

  revalidateCatalog();
  for (const product of products) revalidateCatalog(product.slug);
  redirect(`/admin/produtos?trashed=${products.length}`);
}

export async function restoreProductsFromTrashAction(formData: FormData) {
  await requireAdmin();
  const ids = selectedProductIds(formData);
  if (!ids.length) redirectError("/admin/produtos/lixeira", "Selecione pelo menos um produto para restaurar.");

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, deletedAt: { not: null } },
    select: { id: true, slug: true }
  });
  if (!products.length) redirectError("/admin/produtos/lixeira", "Nenhum produto encontrado na lixeira para restaurar.");

  await prisma.product.updateMany({
    where: { id: { in: products.map((product) => product.id) }, deletedAt: { not: null } },
    data: {
      active: true,
      deletedAt: null,
      deletedByAdminEmail: null,
      deleteNote: null
    }
  });

  revalidateCatalog();
  for (const product of products) revalidateCatalog(product.slug);
  redirect(`/admin/produtos/lixeira?restored=${products.length}`);
}

export async function permanentlyDeleteProductsAction(formData: FormData) {
  await requireAdmin();
  const ids = selectedProductIds(formData);
  if (!ids.length) redirectError("/admin/produtos/lixeira", "Selecione pelo menos um produto para excluir definitivamente.");

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, deletedAt: { not: null } },
    select: { id: true, slug: true, image: true, gallery: true }
  });
  if (!products.length) redirectError("/admin/produtos/lixeira", "Nenhum produto da lixeira foi encontrado para exclusão definitiva.");

  await prisma.product.deleteMany({
    where: { id: { in: products.map((product) => product.id) }, deletedAt: { not: null } }
  });

  await Promise.all(
    products.map((product) =>
      deleteProductImages(product.slug, [product.image, ...product.gallery]).catch((error) => {
        console.error(`Não foi possível limpar imagens do produto ${product.slug}.`, error);
      })
    )
  );

  revalidateCatalog();
  for (const product of products) revalidateCatalog(product.slug);
  redirect(`/admin/produtos/lixeira?deleted=${products.length}`);
}

export async function saveBrandAction(formData: FormData) {
  await requireAdmin();

  const id = field(formData, "brandId");
  const name = field(formData, "name");
  const logo = field(formData, "logo").slice(0, 8).toUpperCase();
  const descriptionPt = field(formData, "descriptionPt") || "Descrição da marca a ajustar.";
  const featured = formData.get("featured") === "on";
  const slug = slugify(name);
  let redirectTo = "/admin/marcas?saved=1";

  if (!name || !slug) redirectError("/admin/marcas", "Informe o nome da marca.");

  try {
    if (id) {
      await prisma.brand.update({
        where: { id },
        data: { name, slug, logo: logo || name.slice(0, 2).toUpperCase(), origin: "", descriptionPt, featured }
      });
    } else {
      await prisma.brand.create({
        data: {
          name,
          slug,
          logo: logo || name.slice(0, 2).toUpperCase(),
          origin: "",
          descriptionPt,
          featured,
          categorySlugs: []
        }
      });
    }
    revalidateCatalog();
  } catch {
    redirectTo = `/admin/marcas?error=${encodeURIComponent("Não foi possível salvar a marca. Verifique duplicidade de nome ou slug.")}`;
  }

  redirect(redirectTo);
}

export async function deleteBrandAction(formData: FormData) {
  await requireAdmin();

  const id = field(formData, "brandId");
  if (!id) redirectError("/admin/marcas", "Marca inválida.");

  const brand = await prisma.brand.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } }
  });

  if (!brand) redirectError("/admin/marcas", "Marca não encontrada.");
  if (brand._count.products > 0) {
    redirectError(
      "/admin/marcas",
      "Esta marca tem produtos. Mova ou remova os produtos antes de excluir."
    );
  }

  await prisma.brand.delete({ where: { id } });
  revalidateCatalog();
  revalidatePath("/admin/marcas");
  redirect("/admin/marcas?deleted=1");
}

export async function saveCategoryAction(formData: FormData) {
  await requireAdmin();

  const id = field(formData, "categoryId");
  const label = field(formData, "label");
  const note = field(formData, "note") || "Ajustar descrição da categoria.";
  const slug = slugify(label);
  let redirectTo = "/admin/categorias?saved=1";

  if (!label || !slug) redirectError("/admin/categorias", "Informe o nome da categoria.");

  try {
    if (id) {
      await prisma.category.update({ where: { id }, data: { label, slug, note } });
    } else {
      await prisma.category.create({ data: { label, slug, note } });
    }
    revalidateCatalog();
  } catch {
    redirectTo = `/admin/categorias?error=${encodeURIComponent("Não foi possível salvar a categoria. Verifique duplicidade de nome ou slug.")}`;
  }

  redirect(redirectTo);
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();

  const id = field(formData, "categoryId");
  if (!id) redirectError("/admin/categorias", "Categoria inválida.");

  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } }
  });

  if (!category) redirectError("/admin/categorias", "Categoria não encontrada.");
  if (category._count.products > 0) {
    redirectError(
      "/admin/categorias",
      "Esta categoria tem produtos. Mova ou remova os produtos antes de excluir."
    );
  }

  await prisma.category.delete({ where: { id } });
  revalidateCatalog();
  revalidatePath("/admin/categorias");
  redirect("/admin/categorias?deleted=1");
}

export async function saveProductSubcategoryAction(formData: FormData) {
  await requireAdmin();

  const id = field(formData, "subcategoryId");
  const categoryId = field(formData, "categoryId");
  const label = field(formData, "label");
  const sortOrder = positiveInt(formData, "sortOrder", 1000);
  const slug = subcategorySlug(label);
  let redirectTo = "/admin/categorias?savedSubcategory=1";

  if (!categoryId || !label || !slug) redirectError("/admin/categorias", "Informe categoria e nome da subcategoria.");

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) redirectError("/admin/categorias", "Categoria da subcategoria não encontrada.");

  const duplicate = await prisma.productSubcategory.findFirst({
    where: {
      categoryId,
      slug,
      ...(id ? { NOT: { id } } : {})
    }
  });
  if (duplicate) redirectError("/admin/categorias", "Já existe uma subcategoria com esse nome nesta categoria.");

  const current = id
    ? await prisma.productSubcategory.findUnique({
        where: { id },
        include: { _count: { select: { products: true } } }
      })
    : null;
  if (id && !current) redirectError("/admin/categorias", "Subcategoria não encontrada.");
  if (current && current.categoryId !== categoryId && current._count.products > 0) {
    redirectError("/admin/categorias", "Subcategoria com produtos não pode trocar de categoria.");
  }

  try {
    if (id) {
      const record = await prisma.productSubcategory.update({
        where: { id },
        data: { categoryId, label, slug, sortOrder }
      });
      await prisma.product.updateMany({
        where: { subcategoryId: record.id },
        data: { categoryId: record.categoryId, subcategory: record.label }
      });
    } else {
      await prisma.productSubcategory.create({
        data: { categoryId, label, slug, sortOrder }
      });
    }
    revalidateCategoryManagement();
  } catch {
    redirectTo = `/admin/categorias?error=${encodeURIComponent("Não foi possível salvar a subcategoria.")}`;
  }

  redirect(redirectTo);
}

export async function deleteProductSubcategoryAction(formData: FormData) {
  await requireAdmin();

  const id = field(formData, "subcategoryId");
  if (!id) redirectError("/admin/categorias", "Subcategoria inválida.");

  const subcategory = await prisma.productSubcategory.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } }
  });

  if (!subcategory) redirectError("/admin/categorias", "Subcategoria não encontrada.");
  if (subcategory._count.products > 0) {
    redirectError("/admin/categorias", "Esta subcategoria tem produtos. Ajuste os produtos antes de excluir.");
  }

  await prisma.productSubcategory.delete({ where: { id } });
  revalidateCategoryManagement();
  redirect("/admin/categorias?deletedSubcategory=1");
}

export async function updateOrderStatusAction(formData: FormData) {
  await requireAdmin();

  const orderNumber = String(formData.get("orderNumber") || "");
  const status = String(formData.get("status") || "");
  if (!orderNumber || !statuses.includes(status as (typeof statuses)[number])) {
    redirect("/admin/pedidos?error=1");
  }

  await prisma.order.update({
    where: { orderNumber },
    data: { status: status as (typeof statuses)[number] }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderNumber}`);
  revalidatePath(`/pedido/${orderNumber}`);
}

export async function confirmManualPixPaymentAction(formData: FormData) {
  await requireAdmin();

  const orderNumber = field(formData, "orderNumber");
  const detailPath = `/admin/pedidos/${orderNumber}`;
  if (!orderNumber) redirectError("/admin/pedidos", "Pedido inválido.");

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { payment: true }
  });
  if (!order) redirectError("/admin/pedidos", "Pedido não encontrado.");
  if (order.payment?.method !== "PIX") redirectError(detailPath, "Este pedido não foi criado com Pix.");

  try {
    await markOrderPaid(orderNumber, {
      provider: "SIMULATED",
      providerPaymentId: `manual-pix-${orderNumber}`,
      providerExternalReference: orderNumber,
      providerStatus: "manual_pix_confirmed",
      providerStatusDetail: "Comprovante Pix conferido manualmente no admin.",
      paidAt: new Date()
    });
  } catch (error) {
    const message = error instanceof OrderError ? error.message : "Não foi possível confirmar o Pix manual.";
    redirectError(detailPath, message);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  revalidatePath(detailPath);
  revalidatePath(`/pedido/${orderNumber}`);
  redirect(`${detailPath}?saved=1`);
}

export async function saveStoreProfileAction(formData: FormData) {
  await requireAdmin();

  const storeName = field(formData, "storeName");
  const legalName = field(formData, "legalName");
  const cnpj = field(formData, "cnpj");
  const stateRegistration = field(formData, "stateRegistration") || "Isento ou a ajustar";
  const cep = formatCep(field(formData, "cep"));
  const state = cleanState(field(formData, "state"));
  const city = field(formData, "city");
  const district = field(formData, "district");
  const street = field(formData, "street");
  const number = field(formData, "number");
  const complement = field(formData, "complement");
  const email = field(formData, "email").toLowerCase();
  const whatsapp = field(formData, "whatsapp");
  const businessHours = field(formData, "businessHours");
  const instagramUrl = optionalHttpUrl(field(formData, "instagramUrl"), "Instagram");
  const facebookUrl = optionalHttpUrl(field(formData, "facebookUrl"), "Facebook");
  const tiktokUrl = optionalHttpUrl(field(formData, "tiktokUrl"), "TikTok");
  const pickupNote = field(formData, "pickupNote");
  const shippingNote = field(formData, "shippingNote");
  const paymentNote = field(formData, "paymentNote");
  const pixPaymentEnabled = formData.get("pixPaymentEnabled") === "on";
  const pixAccountType = includesOption(pixAccountTypeOptions, field(formData, "pixAccountType"))
    ? field(formData, "pixAccountType")
    : "TEMPORARY_PERSONAL";
  const pixRecipientName = field(formData, "pixRecipientName");
  const pixRecipientDocument = field(formData, "pixRecipientDocument");
  const pixKeyType = includesOption(pixKeyTypeOptions, field(formData, "pixKeyType")) ? field(formData, "pixKeyType") : "RANDOM";
  const pixKey = field(formData, "pixKey");
  const pixBankName = field(formData, "pixBankName");
  const mercadoPagoMaxInstallments = Number(field(formData, "mercadoPagoMaxInstallments") || 6);
  const pixInstructions =
    field(formData, "pixInstructions") ||
    "Finalize o pedido, faça o Pix e envie o comprovante pelo WhatsApp para confirmação do atendimento.";
  const exchangeNote = field(formData, "exchangeNote");
  const launchNote = field(formData, "launchNote");
  const trustBadges = parsePipeList(field(formData, "trustBadges")).slice(0, 8);

  if (!storeName) redirectError("/admin/loja", "Informe o nome da loja.");
  if (cnpj && onlyDigits(cnpj).length !== 14) redirectError("/admin/loja", "CNPJ deve ter 14 dígitos.");
  if (cep && onlyDigits(cep).length !== 8) redirectError("/admin/loja", "CEP deve ter 8 dígitos.");
  if (state && state.length !== 2) redirectError("/admin/loja", "UF deve ter 2 letras.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirectError("/admin/loja", "E-mail inválido.");
  if (pixPaymentEnabled && !pixRecipientName) redirectError("/admin/loja", "Informe o nome do recebedor Pix.");
  if (pixPaymentEnabled && !validatePixKey(pixKeyType, pixKey)) {
    redirectError("/admin/loja", "Chave Pix inválida para o tipo selecionado.");
  }

  if (!isMercadoPagoInstallments(mercadoPagoMaxInstallments)) {
    redirectError("/admin/loja", "Selecione parcelamento Mercado Pago de 3x, 6x, 9x ou 12x.");
  }

  await prisma.storeProfile.upsert({
    where: { id: STORE_PROFILE_ID },
    update: {
      storeName,
      legalName,
      cnpj,
      stateRegistration,
      cep,
      state,
      city,
      district,
      street,
      number,
      complement: complement || null,
      email,
      whatsapp,
      businessHours,
      instagramUrl,
      facebookUrl,
      tiktokUrl,
      pickupNote,
      shippingNote,
      paymentNote,
      pixPaymentEnabled,
      pixAccountType,
      pixRecipientName,
      pixRecipientDocument,
      pixKeyType,
      pixKey,
      pixBankName,
      mercadoPagoMaxInstallments,
      pixInstructions,
      exchangeNote,
      trustBadges,
      launchNote
    },
    create: {
      id: STORE_PROFILE_ID,
      storeName,
      legalName,
      cnpj,
      stateRegistration,
      cep,
      state,
      city,
      district,
      street,
      number,
      complement: complement || null,
      email,
      whatsapp,
      businessHours,
      instagramUrl,
      facebookUrl,
      tiktokUrl,
      pickupNote,
      shippingNote,
      paymentNote,
      pixPaymentEnabled,
      pixAccountType,
      pixRecipientName,
      pixRecipientDocument,
      pixKeyType,
      pixKey,
      pixBankName,
      mercadoPagoMaxInstallments,
      pixInstructions,
      exchangeNote,
      trustBadges,
      launchNote
    }
  });

  revalidatePath("/");
  revalidatePath("/informacoes-da-loja");
  revalidatePath("/contato");
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
  revalidatePath("/produto/[slug]", "page");
  revalidatePath("/carrinho");
  revalidatePath("/checkout");
  revalidatePath("/pagamento-simulado/[orderNumber]", "page");
  revalidatePath("/pedido/[orderNumber]", "page");
  revalidatePath("/admin");
  revalidatePath("/admin/loja");
  revalidatePath("/admin/prontidao");
  revalidatePath("/admin/pagamentos");
  redirect("/admin/loja?saved=1");
}

export async function saveSiteInfoPageAction(formData: FormData) {
  await requireAdmin();

  const pageKey = field(formData, "pageKey");
  const sectionTitles = formData.getAll("sectionTitle");
  const sectionBodies = formData.getAll("sectionBody");
  const sectionCount = Math.max(sectionTitles.length, sectionBodies.length);
  const rawSections = Array.from({ length: sectionCount }).map((_, index) => ({
    title: String(sectionTitles[index] || ""),
    body: String(sectionBodies[index] || "")
  }));

  function parsePageInput() {
    try {
      return validateSiteInfoPageInput({
        pageKey,
        eyebrow: formData.get("eyebrow"),
        title: formData.get("title"),
        description: formData.get("description"),
        sections: rawSections
      });
    } catch (error) {
      const message =
        error instanceof SiteInfoPageValidationError
          ? error.message
          : "Não foi possível validar esta página.";
      redirectError(`/admin/politicas?pagina=${encodeURIComponent(pageKey)}`, message);
    }
  }

  const page = parsePageInput();

  await prisma.siteInfoPage.upsert({
    where: { pageKey: page.pageKey },
    update: {
      slug: page.slug,
      href: page.href,
      eyebrow: page.eyebrow,
      title: page.title,
      description: page.description,
      sections: page.sections,
      active: true
    },
    create: {
      pageKey: page.pageKey,
      slug: page.slug,
      href: page.href,
      eyebrow: page.eyebrow,
      title: page.title,
      description: page.description,
      sections: page.sections,
      active: true
    }
  });

  revalidatePath(page.href);
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin");
  revalidatePath("/admin/politicas");
  revalidatePath("/admin/prontidao");
  redirect(`/admin/politicas?pagina=${encodeURIComponent(page.pageKey)}&saved=1`);
}

export async function importProductsAction(formData: FormData) {
  await requireAdmin();

  const csvText = String(formData.get("csvText") || "");
  let redirectTo = "/admin/importar-produtos";

  try {
    const result = await importProductsFromCsv(csvText);
    revalidatePath("/");
    revalidatePath("/categoria/[slug]", "page");
    revalidatePath("/admin/produtos");
    revalidatePath("/admin/importar-produtos");
    revalidatePath("/admin/produtos/qualidade");
    revalidatePath("/admin/prontidao");
    redirectTo = `/admin/importar-produtos?created=${result.created}&updated=${result.updated}&stock=${result.stockUpdated}`;
  } catch (error) {
    const message =
      error instanceof ProductImportError ? error.message : "Não foi possível importar o catálogo.";
    redirectTo = `/admin/importar-produtos?error=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}

export async function updateLaunchReadinessItemAction(formData: FormData) {
  await requireAdmin();

  const itemKey = field(formData, "itemKey");
  const status = field(formData, "status");
  const notes = field(formData, "notes").slice(0, 1200);
  if (!itemKey || !launchReadinessStatuses.includes(status as (typeof launchReadinessStatuses)[number])) {
    redirectError("/admin/prontidao", "Item ou status inválido.");
  }

  const result = await prisma.launchReadinessItem.updateMany({
    where: { itemKey },
    data: {
      status: status as (typeof launchReadinessStatuses)[number],
      notes
    }
  });
  if (result.count === 0) {
    redirectError("/admin/prontidao", "Item de prontidão não encontrado.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/prontidao");
  redirect(`/admin/prontidao?saved=${encodeURIComponent(itemKey)}`);
}
