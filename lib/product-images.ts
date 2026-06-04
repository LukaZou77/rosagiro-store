import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PRODUCT_GALLERY_LIMIT, isAllowedProductImage, normalizeProductGallery } from "@/lib/product-import-shared";

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_UPLOAD_STORAGE = process.env.PRODUCT_IMAGE_STORAGE || "local";

const allowedUploadTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

function uploadRoot() {
  return path.join(process.cwd(), "public", "uploads", "products");
}

function safeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function uploadDir(productSlug: string) {
  return path.join(uploadRoot(), safeSlug(productSlug));
}

function isUploadFile(value: FormDataEntryValue): value is File {
  return typeof value === "object" && "arrayBuffer" in value && "size" in value && value.size > 0;
}

function uploadExtension(file: File) {
  const extension = allowedUploadTypes.get(file.type);
  if (extension) return extension;

  const nameExtension = file.name.split(".").pop()?.toLowerCase();
  if (nameExtension === "jpg" || nameExtension === "jpeg") return "jpg";
  if (nameExtension === "png" || nameExtension === "webp") return nameExtension;
  return "";
}

function assertLocalStorage() {
  if (PRODUCT_UPLOAD_STORAGE !== "local") {
    throw new Error("Armazenamento de imagens ainda está configurado apenas para local nesta versão.");
  }
}

export function extractProductUploads(entries: FormDataEntryValue[]) {
  return entries.filter(isUploadFile);
}

export function assertGalleryCapacity(existingImages: string[], uploadCount: number) {
  if (existingImages.length + uploadCount > PRODUCT_GALLERY_LIMIT) {
    throw new Error(`Cada produto aceita no máximo ${PRODUCT_GALLERY_LIMIT} imagens.`);
  }
}

export async function saveProductImageUploads(productSlug: string, files: File[]) {
  assertLocalStorage();
  if (!files.length) return [];

  const slug = safeSlug(productSlug);
  const dir = uploadDir(slug);
  await mkdir(dir, { recursive: true });

  const uploadedPaths: string[] = [];
  for (const file of files) {
    const extension = uploadExtension(file);
    if (!allowedUploadTypes.has(file.type) || !extension) {
      throw new Error("Envie apenas imagens JPG, PNG ou WebP.");
    }
    if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
      throw new Error("Cada imagem deve ter no máximo 5MB.");
    }

    const fileName = `${Date.now()}-${randomBytes(6).toString("hex")}.${extension}`;
    await writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));
    uploadedPaths.push(`/uploads/products/${slug}/${fileName}`);
  }

  return uploadedPaths;
}

export async function deleteLocalProductImages(productSlug: string, imagePaths: string[]) {
  const slug = safeSlug(productSlug);
  const dir = uploadDir(slug);
  const normalizedDir = path.resolve(dir);
  const localPaths = normalizeProductGallery("", imagePaths).filter((imagePath) =>
    imagePath.startsWith(`/uploads/products/${slug}/`)
  );

  await Promise.all(
    localPaths.map(async (imagePath) => {
      const fileName = path.basename(imagePath);
      const resolved = path.resolve(path.join(dir, fileName));
      if (!resolved.startsWith(`${normalizedDir}${path.sep}`)) return;
      await rm(resolved, { force: true });
    })
  );
}

export function cleanGalleryInput(values: FormDataEntryValue[]) {
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value && isAllowedProductImage(value));
}
