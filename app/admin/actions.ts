"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAdminSession, requireAdmin, setAdminSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { brlInputToCents } from "@/lib/money";
import { importProductsFromCsv, ProductImportError } from "@/lib/product-import";
import { isAllowedProductImage, parseCents, parsePipeList, slugify } from "@/lib/product-import-shared";
import { formatCep } from "@/lib/cep";
import { STORE_PROFILE_ID } from "@/lib/store-profile";

const statuses = ["PENDING_PAYMENT", "PAID", "FULFILLING", "SHIPPED", "CANCELED"] as const;
const launchReadinessStatuses = ["PENDING", "IN_PROGRESS", "DONE", "BLOCKED"] as const;

function field(formData: FormData, name: string) {
  return String(formData.get(name) || "").trim();
}

function positiveInt(formData: FormData, name: string, fallback = 0) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function ratingValue(formData: FormData) {
  const value = Number(field(formData, "rating").replace(",", "."));
  if (!Number.isFinite(value)) return 4.8;
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

  redirectError("/admin/loja", `${fieldLabel} deve ser uma URL http(s) valida.`);
}

function revalidateCatalog(productSlug?: string) {
  revalidatePath("/");
  revalidatePath("/categoria/[slug]", "page");
  revalidatePath("/admin");
  revalidatePath("/admin/produtos");
  revalidatePath("/admin/importar-produtos");
  if (productSlug) revalidatePath(`/produto/${productSlug}`);
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
    ? await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } })
    : null;
  if (!product) redirectError("/admin/produtos", "Produto nao encontrado.");

  const name = field(formData, "name");
  const brandId = field(formData, "brandId");
  const categoryId = field(formData, "categoryId");
  const subcategory = field(formData, "subcategory");
  const descriptionPt = field(formData, "descriptionPt");
  const image = field(formData, "image");
  const priceCents = parseCents(field(formData, "price"));
  const compareAtPriceCents = parseCents(field(formData, "compareAtPrice"));
  const quantity = positiveInt(formData, "quantity");
  const weightGrams = Math.max(1, positiveInt(formData, "weightGrams", 150));
  const reviewCount = positiveInt(formData, "reviewCount");
  const featuredRank = positiveInt(formData, "featuredRank", 1000);
  const active = formData.get("active") === "on";
  const detailPath = `/admin/produtos/${product.slug}`;

  if (!name || !brandId || !categoryId || !subcategory || !descriptionPt || priceCents <= 0) {
    redirectError(detailPath, "Preencha os campos obrigatorios do produto.");
  }
  if (compareAtPriceCents > 0 && compareAtPriceCents <= priceCents) {
    redirectError(detailPath, "O preco comparativo deve ser maior que o preco atual.");
  }
  if (!isAllowedProductImage(image)) {
    redirectError(detailPath, "A imagem deve usar /assets/..., /placeholder... ou URL http(s).");
  }

  const [brand, category] = await Promise.all([
    prisma.brand.findUnique({ where: { id: brandId } }),
    prisma.category.findUnique({ where: { id: categoryId } })
  ]);
  if (!brand || !category) redirectError(detailPath, "Marca ou categoria invalida.");

  await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: {
        name,
        brandId,
        categoryId,
        subcategory,
        priceCents,
        compareAtPriceCents: compareAtPriceCents > 0 ? compareAtPriceCents : null,
        image,
        gallery: [image],
        descriptionPt,
        benefits: parsePipeList(field(formData, "benefits")),
        ingredients: parsePipeList(field(formData, "ingredients")),
        badges: parsePipeList(field(formData, "badges")),
        skinType: field(formData, "skinType") || "A ajustar",
        finish: field(formData, "finish") || "A ajustar",
        volume: field(formData, "volume") || "A ajustar",
        weightGrams,
        rating: ratingValue(formData),
        reviewCount,
        stockStatus: quantity > 0 ? "Em estoque" : "Esgotado",
        active,
        featuredRank
      }
    }),
    prisma.inventory.upsert({
      where: { productId },
      update: { quantity },
      create: { productId, quantity }
    })
  ]);

  revalidateCatalog(product.slug);
  redirect(`${detailPath}?saved=1`);
}

export async function saveBrandAction(formData: FormData) {
  await requireAdmin();

  const id = field(formData, "brandId");
  const name = field(formData, "name");
  const logo = field(formData, "logo").slice(0, 8).toUpperCase();
  const origin = field(formData, "origin") || "A ajustar";
  const descriptionPt = field(formData, "descriptionPt") || "Descricao da marca a ajustar.";
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
    redirectTo = `/admin/marcas?error=${encodeURIComponent("Nao foi possivel salvar a marca. Verifique duplicidade de nome ou slug.")}`;
  }

  redirect(redirectTo);
}

export async function saveCategoryAction(formData: FormData) {
  await requireAdmin();

  const id = field(formData, "categoryId");
  const label = field(formData, "label");
  const note = field(formData, "note") || "Ajustar descricao da categoria.";
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
    redirectTo = `/admin/categorias?error=${encodeURIComponent("Nao foi possivel salvar a categoria. Verifique duplicidade de nome ou slug.")}`;
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
  const exchangeNote = field(formData, "exchangeNote");
  const launchNote = field(formData, "launchNote");
  const trustBadges = parsePipeList(field(formData, "trustBadges")).slice(0, 8);

  if (!storeName || !legalName) redirectError("/admin/loja", "Informe nome da loja e razao social.");
  if (cnpj && onlyDigits(cnpj).length !== 14) redirectError("/admin/loja", "CNPJ deve ter 14 digitos.");
  if (cep && onlyDigits(cep).length !== 8) redirectError("/admin/loja", "CEP deve ter 8 digitos.");
  if (state && state.length !== 2) redirectError("/admin/loja", "UF deve ter 2 letras.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirectError("/admin/loja", "E-mail invalido.");

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
  revalidatePath("/admin");
  revalidatePath("/admin/loja");
  redirect("/admin/loja?saved=1");
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
    redirectTo = `/admin/importar-produtos?created=${result.created}&updated=${result.updated}&stock=${result.stockUpdated}`;
  } catch (error) {
    const message =
      error instanceof ProductImportError ? error.message : "Nao foi possivel importar o catalogo.";
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
    redirectError("/admin/prontidao", "Item ou status invalido.");
  }

  const result = await prisma.launchReadinessItem.updateMany({
    where: { itemKey },
    data: {
      status: status as (typeof launchReadinessStatuses)[number],
      notes
    }
  });
  if (result.count === 0) {
    redirectError("/admin/prontidao", "Item de prontidao nao encontrado.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/prontidao");
  redirect(`/admin/prontidao?saved=${encodeURIComponent(itemKey)}`);
}
