import "server-only";

import { del, put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PRODUCT_GALLERY_LIMIT, isAllowedProductImage, normalizeProductGallery } from "@/lib/product-import-shared";

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_UPLOAD_STORAGE = process.env.PRODUCT_IMAGE_STORAGE || "local";

type ProductUploadStorage = "local" | "vercel_blob";

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

function uploadStorage(): ProductUploadStorage {
  if (PRODUCT_UPLOAD_STORAGE === "local" || PRODUCT_UPLOAD_STORAGE === "vercel_blob") {
    return PRODUCT_UPLOAD_STORAGE;
  }

  throw new Error("Armazenamento de imagens inválido. Use local ou vercel_blob.");
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

function assertBlobStorage() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Configure BLOB_READ_WRITE_TOKEN na Vercel antes de enviar imagens.");
  }
}

function blobPath(slug: string, fileName: string) {
  return `products/${slug}/${fileName}`;
}

function isRosaGiroBlobImage(imagePath: string, slug: string) {
  try {
    const url = new URL(imagePath);
    return url.hostname.endsWith(".blob.vercel-storage.com") && url.pathname.startsWith(`/products/${slug}/`);
  } catch {
    return false;
  }
}

function validateUploadFiles(files: File[]) {
  return files.map((file) => {
    const extension = uploadExtension(file);
    if (!allowedUploadTypes.has(file.type) || !extension) {
      throw new Error("Envie apenas imagens JPG, PNG ou WebP.");
    }
    if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
      throw new Error("Cada imagem deve ter no máximo 5MB.");
    }

    return { file, extension };
  });
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
  if (!files.length) return [];

  const slug = safeSlug(productSlug);
  const preparedFiles = validateUploadFiles(files);
  const storage = uploadStorage();
  const uploadedPaths: string[] = [];

  if (storage === "local") {
    const dir = uploadDir(slug);
    await mkdir(dir, { recursive: true });

    try {
      for (const { file, extension } of preparedFiles) {
        const fileName = `${Date.now()}-${randomBytes(6).toString("hex")}.${extension}`;
        await writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));
        uploadedPaths.push(`/uploads/products/${slug}/${fileName}`);
      }
    } catch (error) {
      await deleteProductImages(slug, uploadedPaths).catch(() => undefined);
      throw error;
    }

    return uploadedPaths;
  }

  assertBlobStorage();
  try {
    for (const { file, extension } of preparedFiles) {
      const fileName = `${Date.now()}-${randomBytes(6).toString("hex")}.${extension}`;
      const blob = await put(blobPath(slug, fileName), file, {
        access: "public",
        contentType: file.type
      });
      uploadedPaths.push(blob.url);
    }
  } catch (error) {
    await deleteProductImages(slug, uploadedPaths).catch(() => undefined);
    throw error;
  }

  return uploadedPaths;
}

export async function deleteProductImages(productSlug: string, imagePaths: string[]) {
  const slug = safeSlug(productSlug);
  const dir = uploadDir(slug);
  const normalizedDir = path.resolve(dir);
  const imageGallery = normalizeProductGallery("", imagePaths);
  const localPaths = imageGallery.filter((imagePath) => imagePath.startsWith(`/uploads/products/${slug}/`));
  const blobPaths = imageGallery.filter((imagePath) => isRosaGiroBlobImage(imagePath, slug));

  await Promise.all(
    localPaths.map(async (imagePath) => {
      const fileName = path.basename(imagePath);
      const resolved = path.resolve(path.join(dir, fileName));
      if (!resolved.startsWith(`${normalizedDir}${path.sep}`)) return;
      await rm(resolved, { force: true });
    })
  );

  if (blobPaths.length && process.env.BLOB_READ_WRITE_TOKEN) {
    await del(blobPaths);
  }
}

export function cleanGalleryInput(values: FormDataEntryValue[]) {
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value && isAllowedProductImage(value));
}
