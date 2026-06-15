"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PRODUCT_GALLERY_LIMIT } from "@/lib/product-import-shared";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type ExistingImage = {
  path: string;
  removed: boolean;
};

type PendingImage = {
  key: string;
  file: File;
  previewUrl: string;
};

type PrimarySelection =
  | { type: "existing"; value: string }
  | { type: "upload"; value: string }
  | { type: "none"; value: "" };

type AdminProductGalleryManagerProps = {
  currentImage: string;
  gallery: string[];
  isEdit: boolean;
};

function bytesLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function updateInputFiles(input: HTMLInputElement | null, images: PendingImage[]) {
  if (!input) return;
  const transfer = new DataTransfer();
  for (const image of images) transfer.items.add(image.file);
  input.files = transfer.files;
}

export function AdminProductGalleryManager({ currentImage, gallery, isEdit }: AdminProductGalleryManagerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);
  const [existingImages, setExistingImages] = useState<ExistingImage[]>(() => gallery.map((path) => ({ path, removed: false })));
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [primary, setPrimary] = useState<PrimarySelection>(
    currentImage ? { type: "existing", value: currentImage } : { type: "none", value: "" }
  );
  const [message, setMessage] = useState("");

  const activeExisting = existingImages.filter((image) => !image.removed);
  const activeCount = activeExisting.length + pendingImages.length;
  const remainingSlots = Math.max(0, PRODUCT_GALLERY_LIMIT - activeCount);
  const primaryUploadIndex = primary.type === "upload" ? pendingImages.findIndex((image) => image.key === primary.value) : -1;

  const removedImages = useMemo(() => existingImages.filter((image) => image.removed), [existingImages]);

  useEffect(
    () => () => {
      for (const image of pendingImagesRef.current) URL.revokeObjectURL(image.previewUrl);
    },
    []
  );

  function syncPendingImages(nextImages: PendingImage[]) {
    setPendingImages((current) => {
      for (const image of current) {
        if (!nextImages.some((nextImage) => nextImage.key === image.key)) URL.revokeObjectURL(image.previewUrl);
      }
      updateInputFiles(fileInputRef.current, nextImages);
      pendingImagesRef.current = nextImages;
      return nextImages;
    });
  }

  function onSelectFiles(files: FileList | null) {
    setMessage("");
    if (!files?.length) return;

    const selected = Array.from(files);
    const errors: string[] = [];
    const accepted: PendingImage[] = [];
    const existingKeys = new Set(pendingImages.map((image) => image.key));

    for (const file of selected) {
      const key = fileKey(file);
      if (existingKeys.has(key) || accepted.some((image) => image.key === key)) continue;
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        errors.push(`${file.name}: use JPG, PNG ou WebP.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        errors.push(`${file.name}: máximo 5MB.`);
        continue;
      }
      accepted.push({ key, file, previewUrl: URL.createObjectURL(file) });
    }

    const availableSlots = PRODUCT_GALLERY_LIMIT - activeExisting.length - pendingImages.length;
    if (accepted.length > availableSlots) {
      for (const image of accepted.slice(availableSlots)) URL.revokeObjectURL(image.previewUrl);
      accepted.length = Math.max(0, availableSlots);
      errors.push(`A galeria aceita no máximo ${PRODUCT_GALLERY_LIMIT} imagens.`);
    }

    const nextImages = [...pendingImages, ...accepted];
    syncPendingImages(nextImages);
    if (primary.type === "none" && nextImages[0]) setPrimary({ type: "upload", value: nextImages[0].key });
    if (errors.length) setMessage(errors.join(" "));
  }

  function removePending(key: string) {
    const nextImages = pendingImages.filter((image) => image.key !== key);
    syncPendingImages(nextImages);
    if (primary.type === "upload" && primary.value === key) {
      const fallback = activeExisting[0]?.path;
      setPrimary(fallback ? { type: "existing", value: fallback } : nextImages[0] ? { type: "upload", value: nextImages[0].key } : { type: "none", value: "" });
    }
  }

  function toggleExistingRemoved(path: string) {
    const willRemovePrimary = primary.type === "existing" && primary.value === path;
    setExistingImages((current) => current.map((image) => (image.path === path ? { ...image, removed: !image.removed } : image)));
    if (willRemovePrimary) {
      const fallbackExisting = activeExisting.find((image) => image.path !== path)?.path;
      setPrimary(fallbackExisting ? { type: "existing", value: fallbackExisting } : pendingImages[0] ? { type: "upload", value: pendingImages[0].key } : { type: "none", value: "" });
    }
  }

  return (
    <div className="product-gallery-manager">
      <div className="product-gallery-heading">
        <div>
          <strong>Galeria do produto</strong>
          <small>Escolha várias imagens e salve junto com os dados do produto.</small>
        </div>
        <span>{activeCount}/{PRODUCT_GALLERY_LIMIT}</span>
      </div>

      {activeExisting.map((image) => (
        <input type="hidden" name="galleryExisting" value={image.path} key={`keep-${image.path}`} />
      ))}
      {removedImages.map((image) => (
        <input type="hidden" name="removeGalleryImage" value={image.path} key={`remove-${image.path}`} />
      ))}
      {primary.type === "existing" ? <input type="hidden" name="primaryImage" value={primary.value} /> : null}
      {primaryUploadIndex >= 0 ? <input type="hidden" name="primaryUploadIndex" value={String(primaryUploadIndex)} /> : null}
      {primary.type === "upload" && primaryUploadIndex === 0 ? <input type="hidden" name="firstUploadAsPrimary" value="on" /> : null}

      <div className="product-gallery-grid">
        {existingImages.map((image) => (
          <div className={`product-gallery-slot ${image.removed ? "is-removed" : ""}`} key={image.path}>
            <img src={image.path} alt="" loading="lazy" />
            <label className="radio-label">
              <input
                name="primaryChoice"
                type="radio"
                checked={primary.type === "existing" && primary.value === image.path}
                disabled={image.removed}
                onChange={() => setPrimary({ type: "existing", value: image.path })}
              />
              Principal
            </label>
            <label className="checkbox-label compact">
              <input checked={image.removed} type="checkbox" onChange={() => toggleExistingRemoved(image.path)} />
              Remover
            </label>
            {image.removed ? <small className="product-gallery-warning">Será removida ao salvar.</small> : null}
          </div>
        ))}

        {pendingImages.map((image) => (
          <div className="product-gallery-slot pending" key={image.key}>
            <img src={image.previewUrl} alt="" />
            <label className="radio-label">
              <input
                name="primaryChoice"
                type="radio"
                checked={primary.type === "upload" && primary.value === image.key}
                onChange={() => setPrimary({ type: "upload", value: image.key })}
              />
              Principal
            </label>
            <small>{image.file.name}</small>
            <small>{bytesLabel(image.file.size)}</small>
            <button className="button subtle compact-button" type="button" onClick={() => removePending(image.key)}>
              Remover
            </button>
          </div>
        ))}

        {Array.from({ length: remainingSlots }).map((_, index) => (
          <div className="product-gallery-slot empty" key={`empty-${index}`}>
            <span>Vazio</span>
          </div>
        ))}
      </div>

      <label className="product-upload-field">
        Enviar novas imagens
        <input
          ref={fileInputRef}
          name="galleryFiles"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) => onSelectFiles(event.currentTarget.files)}
        />
      </label>
      <p className="table-note">
        As imagens escolhidas ainda não foram enviadas. Clique em {isEdit ? "Salvar ficha completa" : "Criar produto"} para salvar
        imagens e dados juntos.
      </p>
      <p className="table-note">JPG, PNG ou WebP. Máximo 5MB por imagem. Restam {remainingSlots} vaga(s).</p>
      {message ? <p className="form-error">{message}</p> : null}
    </div>
  );
}
