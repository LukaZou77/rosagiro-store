import Image from "next/image";

type OptimizedProductImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fill?: boolean;
  width?: number;
  height?: number;
  loading?: "eager" | "lazy";
  draggable?: boolean;
};

const SOURCE_BOARD_PATH = /^\/products\/boards\/[^/]+\/[a-f0-9]{64}\.(?:jpe?g|png|webp)$/i;

/**
 * Production board images use an immutable source-ID and SHA-256 key. Keeping
 * this recognition narrow prevents legacy product photos from changing their
 * presentation rules merely because they happen to live in Blob storage.
 */
export function isSourceBoardImage(src?: string | null) {
  if (!src) return false;

  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com") && SOURCE_BOARD_PATH.test(url.pathname);
  } catch {
    return false;
  }
}

function canOptimizeImage(src: string) {
  if (/\.svg(?:$|\?)/i.test(src)) return false;
  if (src.startsWith("/")) return true;
  try {
    const url = new URL(src);
    return (
      url.protocol === "https:" &&
      (url.hostname === "rosagiro.com.br" ||
        url.hostname === "www.rosagiro.com.br" ||
        url.hostname.endsWith(".public.blob.vercel-storage.com"))
    );
  } catch {
    return false;
  }
}

export function OptimizedProductImage({
  src,
  alt,
  className,
  sizes,
  priority = false,
  fill = false,
  width = 800,
  height = 800,
  loading = "lazy",
  draggable
}: OptimizedProductImageProps) {
  if (!src) return null;

  const imageClassName = [className, isSourceBoardImage(src) ? "source-board-image" : ""].filter(Boolean).join(" ") || undefined;

  if (!canOptimizeImage(src)) {
    return (
      <img
        alt={alt}
        className={imageClassName}
        draggable={draggable}
        loading={priority ? "eager" : loading}
        src={src}
      />
    );
  }

  if (fill) {
    return (
      <Image
        alt={alt}
        className={imageClassName}
        draggable={draggable}
        fill
        priority={priority}
        sizes={sizes}
        src={src}
      />
    );
  }

  return (
    <Image
      alt={alt}
      className={imageClassName}
      draggable={draggable}
      height={height}
      loading={priority ? undefined : loading}
      priority={priority}
      sizes={sizes}
      src={src}
      width={width}
    />
  );
}
