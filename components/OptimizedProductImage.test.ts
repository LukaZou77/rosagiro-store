import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isSourceBoardImage } from "./OptimizedProductImage";

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

test("source board previews preserve the whole frame in cards and gallery", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.product-image img\.source-board-image,\s*\.product-gallery-thumbs img\.source-board-image\s*\{\s*object-fit: contain;/);
  assert.match(css, /\.product-card:hover \.product-image img\.source-board-image\s*\{\s*transform: none;/);
});
