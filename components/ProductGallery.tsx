"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { OptimizedProductImage } from "@/components/OptimizedProductImage";

const PRODUCT_IMAGE_SELECT_EVENT = "rosagiro:select-product-image";

type ProductGalleryProps = {
  images: string[];
  productName: string;
};

type ProductGalleryCarouselProps = {
  gallery: string[];
  productName: string;
};

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const gallery = useMemo(() => Array.from(new Set(images.filter(Boolean))), [images]);
  const galleryKey = gallery.join("|");

  return <ProductGalleryCarousel gallery={gallery} key={galleryKey} productName={productName} />;
}

function ProductGalleryCarousel({ gallery, productName }: ProductGalleryCarouselProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const activeIndex = gallery[selectedIndex] ? selectedIndex : 0;
  const activeImage = gallery[activeIndex] || "";
  const hasCarousel = gallery.length > 1;

  useEffect(() => {
    if (!isLightboxOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus({ preventScroll: true });

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Tab") {
        const dialog = document.querySelector(".product-lightbox");
        const focusableElements = Array.from(
          dialog?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") || [],
        ).filter((element) => !element.hasAttribute("disabled"));
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (firstElement && lastElement) {
          if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setIsLightboxOpen(false);
        setIsZooming(false);
        window.setTimeout(() => {
          (lastFocusedRef.current || mainRef.current)?.focus({ preventScroll: true });
        }, 0);
      }
      if (hasCarousel && event.key === "ArrowLeft") {
        event.preventDefault();
        setSelectedIndex((current) => (current - 1 + gallery.length) % gallery.length);
        setIsZooming(false);
      }
      if (hasCarousel && event.key === "ArrowRight") {
        event.preventDefault();
        setSelectedIndex((current) => (current + 1 + gallery.length) % gallery.length);
        setIsZooming(false);
      }
    }

    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [gallery.length, hasCarousel, isLightboxOpen]);

  useEffect(() => {
    function handleSkuImageSelect(event: Event) {
      const image = (event as CustomEvent<{ image?: string }>).detail?.image;
      if (!image) return;
      const nextIndex = gallery.indexOf(image);
      if (nextIndex < 0) return;
      setSelectedIndex(nextIndex);
      setIsZooming(false);
    }

    window.addEventListener(PRODUCT_IMAGE_SELECT_EVENT, handleSkuImageSelect);
    return () => window.removeEventListener(PRODUCT_IMAGE_SELECT_EVENT, handleSkuImageSelect);
  }, [gallery]);

  function selectImage(index: number) {
    setSelectedIndex(index);
    setIsZooming(false);
  }

  function moveImage(step: number) {
    if (!hasCarousel) return;
    setSelectedIndex((current) => (current + step + gallery.length) % gallery.length);
    setIsZooming(false);
  }

  function openLightbox() {
    if (!activeImage) return;
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      lastFocusedRef.current = document.activeElement;
    }
    setIsZooming(false);
    setIsLightboxOpen(true);
  }

  function closeLightbox() {
    setIsLightboxOpen(false);
    setIsZooming(false);
    window.setTimeout(() => {
      (lastFocusedRef.current || mainRef.current)?.focus({ preventScroll: true });
    }, 0);
  }

  function handleMainKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openLightbox();
      return;
    }
    if (hasCarousel && event.key === "ArrowLeft") {
      event.preventDefault();
      moveImage(-1);
    }
    if (hasCarousel && event.key === "ArrowRight") {
      event.preventDefault();
      moveImage(1);
    }
  }

  function canUseHoverZoom() {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (isLightboxOpen) return;
    if (!canUseHoverZoom()) return;
    const target = mainRef.current;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    target.style.setProperty("--zoom-x", `${Math.min(100, Math.max(0, x)).toFixed(2)}%`);
    target.style.setProperty("--zoom-y", `${Math.min(100, Math.max(0, y)).toFixed(2)}%`);
    if (!isZooming) setIsZooming(true);
  }

  function stopZoom() {
    setIsZooming(false);
  }

  if (!activeImage) {
    return <div className="product-gallery-main placeholder" aria-label="Produto sem imagem cadastrada" />;
  }

  return (
    <div
      aria-label={`Galeria de imagens de ${productName}`}
      className={`product-gallery ${hasCarousel ? "has-carousel" : "single-image"}`}
    >
      {hasCarousel ? (
        <div className="product-gallery-thumbs" aria-label="Imagens do produto">
          {gallery.map((image, index) => (
            <button
              aria-label={`Ver imagem ${index + 1} de ${productName}`}
              aria-pressed={index === activeIndex}
              className={index === activeIndex ? "active" : ""}
              key={image}
              onClick={() => selectImage(index)}
              type="button"
            >
              <OptimizedProductImage src={image} alt="" width={72} height={72} sizes="72px" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
      <div className="product-gallery-viewer">
        {hasCarousel ? (
          <button
            aria-label="Imagem anterior"
            className="product-gallery-arrow previous"
            onClick={() => moveImage(-1)}
            type="button"
          >
            <span aria-hidden="true">&lsaquo;</span>
          </button>
        ) : null}
        <div
          aria-label={`Ver imagem ampliada de ${productName}`}
          aria-live="polite"
          className={`product-gallery-main ${isZooming ? "zooming" : ""}`}
          onClick={openLightbox}
          onKeyDown={handleMainKeyDown}
          onPointerLeave={stopZoom}
          onPointerMove={handlePointerMove}
          ref={mainRef}
          role="button"
          tabIndex={0}
        >
          <OptimizedProductImage
            alt={productName}
            className="product-gallery-image"
            draggable={false}
            fill
            priority
            sizes="(min-width: 960px) 48vw, 100vw"
            src={activeImage}
          />
          <span className="product-gallery-zoom-hint">Ver maior</span>
          {hasCarousel ? <span className="product-gallery-count">{activeIndex + 1}/{gallery.length}</span> : null}
        </div>
        {hasCarousel ? (
          <button
            aria-label="Próxima imagem"
            className="product-gallery-arrow next"
            onClick={() => moveImage(1)}
            type="button"
          >
            <span aria-hidden="true">&rsaquo;</span>
          </button>
        ) : null}
      </div>
      {isLightboxOpen ? (
        <div
          aria-label={`Imagem ampliada de ${productName}`}
          aria-modal="true"
          className="product-lightbox"
          onClick={closeLightbox}
          role="dialog"
        >
          <div className="product-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <div className="product-lightbox-header">
              <div>
                <strong>{productName}</strong>
                {hasCarousel ? <span>Imagem {activeIndex + 1} de {gallery.length}</span> : null}
              </div>
              <button
                aria-label="Fechar imagem ampliada"
                className="product-lightbox-close"
                onClick={closeLightbox}
                ref={closeButtonRef}
                type="button"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="product-lightbox-stage">
              {hasCarousel ? (
                <button
                  aria-label="Imagem anterior"
                  className="product-lightbox-arrow previous"
                  onClick={() => moveImage(-1)}
                  type="button"
                >
                  <span aria-hidden="true">&lsaquo;</span>
                </button>
              ) : null}
              <OptimizedProductImage
                alt={productName}
                className="product-lightbox-image"
                draggable={false}
                height={1200}
                sizes="96vw"
                src={activeImage}
                width={1200}
              />
              {hasCarousel ? (
                <button
                  aria-label="Próxima imagem"
                  className="product-lightbox-arrow next"
                  onClick={() => moveImage(1)}
                  type="button"
                >
                  <span aria-hidden="true">&rsaquo;</span>
                </button>
              ) : null}
            </div>
            {hasCarousel ? (
              <div className="product-lightbox-thumbs" aria-label="Imagens ampliadas do produto">
                {gallery.map((image, index) => (
                  <button
                    aria-label={`Ver imagem ampliada ${index + 1} de ${productName}`}
                    aria-pressed={index === activeIndex}
                    className={index === activeIndex ? "active" : ""}
                    key={image}
                    onClick={() => selectImage(index)}
                    type="button"
                  >
                    <OptimizedProductImage src={image} alt="" width={72} height={72} sizes="72px" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
