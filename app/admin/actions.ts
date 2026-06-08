"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAdminSession, requireAdmin, setAdminSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { brlInputToCents } from "@/lib/money";
import { markOrderPaid, OrderError } from "@/lib/orders";
import { importProductsFromCsv, ProductImportError } from "@/lib/product-import";
import { isAllowedProductImage, normalizeProductGallery, parseCents, parsePipeList, slugify } from "@/lib/product-import-shared";
import {
  assertGalleryCapacity,
  cleanGalleryInput,
  deleteLocalProductImages,
  extractProductUploads,
  saveProductImageUploads
} from "@/lib/product-images";
import { formatCep } from "@/lib/cep";
import { pixAccountTypeOptions, pixKeyTypeOptions, STORE_PROFILE_ID } from "@/lib/store-profile";
import { SiteInfoPageValidationError, validateSiteInfoPageInput } from "@/lib/site-info-pages";

const statuses = ["PENDING_PAYMENT", "PAID", "FULFILLING", "SHIPPED", "CANCELED"] as const;
const launchReadinessStatuses = ["PENDING", "IN_PROGRESS", "DONE", "BLOCKED"] as const;

function field(formData: FormData, name: string) {
  return String(formData.get(name) || "").trim();
}

function positiveInt(formData: FormData, name: string, fallback = 0) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function optionalPositiveInt(formData: FormData, name: string) {
  const raw = field(formData, name);
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function nullableField(formData: FormData, name: string) {
  return field(formData, name) || null;
}

function ratingValueWithFallback(formData: FormData, fallback: number) {
  const value = Number(field(formData, "rating").replace(",", "."));
  if (!Number.isFinite(value)) return fallback;
  return Math.min(5, Math.max(0, value));
}

function redirectError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
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
  revalidatePath("/admin/produtos/qualidade");
  revalidatePath("/admin/importar-produtos");
  revalidatePath("/admin/prontidao");
  if (productSlug) revalidatePath(`/produto/${productSlug}`);
}

type ProductFormPreparationOptions = {
  detailPath: string;
  productSlug: string;
  existingImage?: string;
  existingGallery?: string[];
  defaultRating: number;
};

async function prepareProductFormPayload(formData: FormData, options: ProductFormPreparationOptions) {
  const name = field(formData, "name");
  const brandId = field(formData, "brandId");
  const categoryId = field(formData, "categoryId");
  const subcategory = field(formData, "subcategory");
  const descriptionPt = field(formData, "descriptionPt");
  const image = field(formData, "image");
  const primaryImageInput = field(formData, "primaryImage");
  const priceCents = parseCents(field(formData, "price"));
  const compareAtPriceCents = parseCents(field(formData, "compareAtPrice"));
  const quantity = positiveInt(formData, "quantity");
  const weightGrams = Math.max(1, positiveInt(formData, "weightGrams", 150));
  const suggestedQuantity = optionalPositiveInt(formData, "suggestedQuantity");
  const reviewCount = positiveInt(formData, "reviewCount");
  const featuredRank = positiveInt(formData, "featuredRank", 1000);
  const active = formData.get("active") === "on";

  if (!name || !brandId || !categoryId || !subcategory || !descriptionPt || priceCents <= 0) {
    redirectError(options.detailPath, "Preencha os campos obrigatórios do produto.");
  }
  if (compareAtPriceCents > 0 && compareAtPriceCents <= priceCents) {
    redirectError(options.detailPath, "O preço comparativo deve ser maior que o preço atual.");
  }
  if (field(formData, "suggestedQuantity") && suggestedQuantity === null) {
    redirectError(options.detailPath, "Quantidade sugerida deve ser um número maior que zero.");
  }
  if (image && !isAllowedProductImage(image)) {
    redirectError(options.detailPath, "A imagem deve usar /assets/..., /uploads/products/..., /placeholder... ou URL http(s).");
  }

  const [brand, category] = await Promise.all([
    prisma.brand.findUnique({ where: { id: brandId } }),
    prisma.category.findUnique({ where: { id: categoryId } })
  ]);
  if (!brand || !category) redirectError(options.detailPath, "Marca ou categoria inválida.");

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
  const preferredPrimary = firstUploadAsPrimary && uploadedImages[0] ? uploadedImages[0] : primaryImageInput;
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
      subcategory,
      priceCents,
      compareAtPriceCents: compareAtPriceCents > 0 ? compareAtPriceCents : null,
      image: primaryImage,
      gallery,
      descriptionPt,
      benefits: parsePipeList(field(formData, "benefits")),
      ingredients: parsePipeList(field(formData, "ingredients")),
      badges: parsePipeList(field(formData, "badges")),
      skinType: field(formData, "skinType") || "A ajustar",
      finish: field(formData, "finish") || "A ajustar",
      volume: field(formData, "volume") || "A ajustar",
      weightGrams,
      suggestedQuantity,
      kitRecommendation: nullableField(formData, "kitRecommendation"),
      wholesalePackage: nullableField(formData, "wholesalePackage"),
      validityNote: nullableField(formData, "validityNote"),
      purchaseNote: nullableField(formData, "purchaseNote"),
      rating: ratingValueWithFallback(formData, options.defaultRating),
      reviewCount,
      stockStatus: quantity > 0 ? "Em estoque" : "Esgotado",
      active,
      featuredRank
    },
    quantity,
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
  const subcategory = String(formData.get("subcategory") || "").trim();
  const descriptionPt = String(formData.get("descriptionPt") || "").trim();
  const priceCents = brlInputToCents(formData.get("price"));
  const compareAtPriceCents = brlInputToCents(formData.get("compareAtPrice"));
  const quantity = Math.max(0, Number(formData.get("quantity")) || 0);
  const active = formData.get("active") === "on";

  if (!productId || !name || !subcategory || !descriptionPt || priceCents <= 0) {
    redirect("/admin/produtos?error=1");
  }

  await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: {
        name,
        subcategory,
        descriptionPt,
        priceCents,
        compareAtPriceCents: compareAtPriceCents > 0 ? compareAtPriceCents : null,
        active,
        stockStatus: quantity > 0 ? "Em estoque" : "Esgotado"
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
    ? await prisma.product.findUnique({ where: { id: productId }, select: { slug: true, image: true, gallery: true } })
    : null;
  if (!product) redirectError("/admin/produtos", "Produto não encontrado.");

  const detailPath = `/admin/produtos/${product.slug}`;
  const prepared = await prepareProductFormPayload(formData, {
    detailPath,
    productSlug: product.slug,
    existingImage: product.image,
    existingGallery: product.gallery,
    defaultRating: 4.8
  });

  try {
    await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: prepared.data
      }),
      prisma.inventory.upsert({
        where: { productId },
        update: { quantity: prepared.quantity },
        create: { productId, quantity: prepared.quantity }
      })
    ]);
  } catch {
    await deleteLocalProductImages(product.slug, prepared.uploadedImages);
    redirectError(detailPath, "Não foi possível salvar o produto. Tente novamente.");
  }

  await deleteLocalProductImages(product.slug, prepared.removedImages.filter((galleryImage) => !prepared.gallery.includes(galleryImage)));
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
  const existingProduct = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  if (existingProduct) redirectError(detailPath, "Este slug já existe. Use outro identificador para o produto.");

  const prepared = await prepareProductFormPayload(formData, {
    detailPath,
    productSlug: slug,
    defaultRating: 0
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

      await tx.inventory.create({
        data: { productId: createdProduct.id, quantity: prepared.quantity }
      });

      return createdProduct;
    });
  } catch {
    await deleteLocalProductImages(slug, prepared.uploadedImages);
    redirectError(detailPath, "Não foi possível criar o produto. Verifique os dados e tente novamente.");
  }

  revalidateCatalog(product.slug);
  redirect(`/admin/produtos/${product.slug}?saved=1`);
}

export async function saveBrandAction(formData: FormData) {
  await requireAdmin();

  const id = field(formData, "brandId");
  const name = field(formData, "name");
  const logo = field(formData, "logo").slice(0, 8).toUpperCase();
  const origin = field(formData, "origin") || "A ajustar";
  const descriptionPt = field(formData, "descriptionPt") || "Descrição da marca a ajustar.";
  const featured = formData.get("featured") === "on";
  const slug = slugify(name);
  let redirectTo = "/admin/marcas?saved=1";

  if (!name || !slug) redirectError("/admin/marcas", "Informe o nome da marca.");

  try {
    if (id) {
      await prisma.brand.update({
        where: { id },
        data: { name, slug, logo: logo || name.slice(0, 2).toUpperCase(), origin, descriptionPt, featured }
      });
    } else {
      await prisma.brand.create({
        data: {
          name,
          slug,
          logo: logo || name.slice(0, 2).toUpperCase(),
          origin,
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
  const pixInstructions =
    field(formData, "pixInstructions") ||
    "Finalize o pedido, faça o Pix e envie o comprovante pelo WhatsApp para confirmação do atendimento.";
  const exchangeNote = field(formData, "exchangeNote");
  const launchNote = field(formData, "launchNote");
  const trustBadges = parsePipeList(field(formData, "trustBadges")).slice(0, 8);

  if (!storeName || !legalName) redirectError("/admin/loja", "Informe nome da loja e razão social.");
  if (cnpj && onlyDigits(cnpj).length !== 14) redirectError("/admin/loja", "CNPJ deve ter 14 dígitos.");
  if (cep && onlyDigits(cep).length !== 8) redirectError("/admin/loja", "CEP deve ter 8 dígitos.");
  if (state && state.length !== 2) redirectError("/admin/loja", "UF deve ter 2 letras.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirectError("/admin/loja", "E-mail inválido.");
  if (pixPaymentEnabled && !pixRecipientName) redirectError("/admin/loja", "Informe o nome do recebedor Pix.");
  if (pixPaymentEnabled && !validatePixKey(pixKeyType, pixKey)) {
    redirectError("/admin/loja", "Chave Pix inválida para o tipo selecionado.");
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
      pixInstructions,
      exchangeNote,
      trustBadges,
      launchNote
    }
  });

  revalidatePath("/");
  revalidatePath("/informacoes-da-loja");
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
