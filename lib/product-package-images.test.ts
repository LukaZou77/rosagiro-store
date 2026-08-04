import assert from "node:assert/strict";
import test from "node:test";
import { isProductPackageImage, orderProductDetailImages } from "./product-package-images";

test("identifies only reviewed package image file names", () => {
  assert.equal(isProductPackageImage("https://blob.example/products/item/package-hb-m701.jpg"), true);
  assert.equal(isProductPackageImage("/uploads/products/item/package-clean-hb-m701.webp?cache=1"), true);
  assert.equal(isProductPackageImage("https://blob.example/products/item/tray-hb-m701.jpg"), false);
  assert.equal(isProductPackageImage("https://blob.example/products/item/sku-01-hb-m701.jpg"), false);
});

test("places the closed package after the primary product image", () => {
  assert.deepEqual(
    orderProductDetailImages(
      "/main.jpg",
      ["/detail.jpg", "/package-model.jpg", "/main.jpg"],
      ["/sku-01.jpg", "/package-model.jpg"]
    ),
    ["/main.jpg", "/package-model.jpg", "/detail.jpg", "/sku-01.jpg"]
  );
});
