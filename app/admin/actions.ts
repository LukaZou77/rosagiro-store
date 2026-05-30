"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAdminSession, requireAdmin, setAdminSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { brlInputToCents } from "@/lib/money";
import { importProductsFromCsv, ProductImportError } from "@/lib/product-import";

const statuses = ["PENDING_PAYMENT", "PAID", "FULFILLING", "SHIPPED", "CANCELED"] as const;

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
