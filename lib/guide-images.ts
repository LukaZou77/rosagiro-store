import "server-only";

import { del, put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PRODUCT_IMAGE_MAX_BYTES, PRODUCT_UPLOAD_STORAGE } from "@/lib/product-images";

type GuideUploadStorage = "local" | "vercel_blob";

const allowedUploadTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

function safeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function uploadRoot() {
  return path.join(process.cwd(), "public", "uploads", "guides");
}

function uploadDir(guideSlug: string) {
  return path.join(uploadRoot(), safeSlug(guideSlug));
}

function uploadStorage(): GuideUploadStorage {
  if (PRODUCT_UPLOAD_STORAGE === "local" || PRODUCT_UPLOAD_STORAGE === "vercel_blob") {
    return PRODUCT_UPLOAD_STORAGE;
  }
  throw new Error("Armazenamento de imagens invalido. Use local ou vercel_blob.");
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value && "size" in value && value.size > 0);
}

function uploadExtension(file: File) {
  const extension = allowedUploadTypes.get(file.type);
  if (extension) return extension;

  const nameExtension = file.name.split(".").pop()?.toLowerCase();
  if (nameExtension === "jpg" || nameExtension === "jpeg") return "jpg";
  if (nameExtension === "png" || nameExtension === "webp") return nameExtension;
  return "";
}

function validateUploadFile(file: File) {
  const extension = uploadExtension(file);
  if (!allowedUploadTypes.has(file.type) || !extension) {
    throw new Error("Envie apenas imagens JPG, PNG ou WebP.");
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error("A imagem de capa deve ter no maximo 5MB.");
  }
  return extension;
}

function assertBlobStorage() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Configure BLOB_READ_WRITE_TOKEN na Vercel antes de enviar imagens.");
  }
}

function blobPath(slug: string, fileName: string) {
  return `guides/${slug}/${fileName}`;
}

function isRosaGiroGuideBlobImage(imagePath: string, slug: string) {
  try {
    const url = new URL(imagePath);
    return url.hostname.endsWith(".blob.vercel-storage.com") && url.pathname.startsWith(`/guides/${slug}/`);
  } catch {
    return false;
  }
}

export function extractGuideCoverUpload(value: FormDataEntryValue | null) {
  return isUploadFile(value) ? value : null;
}

export async function saveGuideCoverUpload(guideSlug: string, file: File | null) {
  if (!file) return "";

  const slug = safeSlug(guideSlug);
  const extension = validateUploadFile(file);
  const fileName = `${Date.now()}-${randomBytes(6).toString("hex")}.${extension}`;
  const storage = uploadStorage();

  if (storage === "local") {
    const dir = uploadDir(slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));
    return `/uploads/guides/${slug}/${fileName}`;
  }

  assertBlobStorage();
  const blob = await put(blobPath(slug, fileName), file, {
    access: "public",
    contentType: file.type
  });
  return blob.url;
}

export async function deleteGuideImages(guideSlug: string, imagePaths: string[]) {
  const slug = safeSlug(guideSlug);
  const dir = uploadDir(slug);
  const normalizedDir = path.resolve(dir);
  const cleanPaths = imagePaths.map((imagePath) => imagePath.trim()).filter(Boolean);
  const localPaths = cleanPaths.filter((imagePath) => imagePath.startsWith(`/uploads/guides/${slug}/`));
  const blobPaths = cleanPaths.filter((imagePath) => isRosaGiroGuideBlobImage(imagePath, slug));

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
