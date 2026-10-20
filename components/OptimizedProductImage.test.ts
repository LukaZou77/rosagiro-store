import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isSourceBoardImage, OptimizedProductImage } from "./OptimizedProductImage";

const blobHost = "https://store.public.blob.vercel-storage.com";
const sha = "a".repeat(64);

test("recognizes only immutable source-board Blob URLs", () => {
  assert.equal(isSourceBoardImage(`${blobHost}/products/boards/1Ab_Cd-9/${sha}.jpg`), true);
  assert.equal(isSourceBoardImage(`${blobHost}/products/boards/1Ab_Cd-9/${sha}.jpg?download=1`), true);
  assert.equal(isSourceBoardImage(`${blobHost}/products/boards/1Ab_Cd-9/${sha}.png`), true);
});

test("does not change presentation rules for legacy, malformed, or foreign URLs", () => {
  assert.equal(isSourceBoardImage(`${blobHost}/products/item/sku-01.jpg`), false);
  assert.equal(isSourceBoardImage(`${blobHost}/products/boards/source/not-a-sha.jpg`), false);
  assert.equal(isSourceBoardImage(`https://example.com/products/boards/source/${sha}.jpg`), false);
  assert.equal(isSourceBoardImage("/uploads/products/item/photo.jpg"), false);
  assert.equal(isSourceBoardImage(null), false);
});

test("restored source boards keep the immutable source ID and digest convention", () => {
  assert.equal(isSourceBoardImage(`${blobHost}/products/boards/restored-source-42/${sha}.jpg`), true);
  assert.equal(isSourceBoardImage(`${blobHost}/products/boards/restored-source-42/${sha.slice(1)}.jpg`), false);
  assert.equal(isSourceBoardImage(`http://store.public.blob.vercel-storage.com/products/boards/source/${sha}.jpg`), false);
});

test("optimized and fallback images mark only boards for gallery containment", () => {
  for (const src of ["/uploads/package-model.jpg", "https://external.example/package-clean-model.jpg"]) {
    const image = OptimizedProductImage({ src, alt: "Produto", className: "product-gallery-image" });
    assert.match(image?.props.className || "", /product-gallery-image package-board-image/);
  }
  const source = OptimizedProductImage({ src: `${blobHost}/products/boards/restored/${sha}.jpg`, alt: "Produto", fill: true });
  assert.equal(source?.props.className, "source-board-image");
  const photo = OptimizedProductImage({ src: "/uploads/photo.jpg", alt: "Produto" });
  assert.equal(photo?.props.className, undefined);
});

test("source board previews preserve the whole frame in cards and gallery", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.product-image img\.source-board-image,\s*\.product-gallery-thumbs img\.source-board-image\s*\{\s*object-fit: contain;/);
  assert.match(css, /\.product-card:hover \.product-image img\.source-board-image\s*\{\s*transform: none;/);
});
