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

  if (!canOptimizeImage(src)) {
    return (
      <img
        alt={alt}
        className={className}
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
        className={className}
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
      className={className}
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
