import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canUseGalleryHoverPointer, createAnimationFrameBatcher, galleryZoomPercent } from "./ProductGalleryPerformance";

const gallerySource = readFileSync(new URL("./ProductGallery.tsx", import.meta.url), "utf8");

test("gallery hover accepts only primary non-touch pointers", () => {
  assert.equal(canUseGalleryHoverPointer({ pointerType: "mouse", isPrimary: true }), true);
  assert.equal(canUseGalleryHoverPointer({ pointerType: "pen", isPrimary: true }), true);
  assert.equal(canUseGalleryHoverPointer({ pointerType: "touch", isPrimary: true }), false);
  assert.equal(canUseGalleryHoverPointer({ pointerType: "mouse", isPrimary: false }), false);
});

test("gallery gates both pointer entry and movement and does not capture lightbox state in the frame flush", () => {
  assert.equal(gallerySource.match(/canUseGalleryHoverPointer\(event\)/g)?.length, 2);
  assert.doesNotMatch(gallerySource, /currentBounds[^\n]+isLightboxOpen/);
});

test("gallery zoom percentages are clamped and reject invalid geometry", () => {
  const bounds = { left: 10, top: 20, width: 200, height: 100 };
  assert.deepEqual(galleryZoomPercent(bounds, { clientX: 110, clientY: 45 }), { x: 50, y: 25 });
  assert.deepEqual(galleryZoomPercent(bounds, { clientX: -100, clientY: 500 }), { x: 0, y: 100 });
  assert.equal(galleryZoomPercent({ ...bounds, width: 0 }, { clientX: 10, clientY: 20 }), null);
});

test("animation frame batcher flushes only the latest point once per frame", () => {
  const callbacks = new Map<number, FrameRequestCallback>();
  const cancelled: number[] = [];
  const flushed: number[] = [];
  let nextHandle = 1;
  const batcher = createAnimationFrameBatcher<number>({
    requestFrame(callback) {
      const handle = nextHandle++;
      callbacks.set(handle, callback);
      return handle;
    },
    cancelFrame(handle) {
      cancelled.push(handle);
      callbacks.delete(handle);
    },
    flush(value) {
      flushed.push(value);
    }
  });

  batcher.schedule(1);
  batcher.schedule(2);
  assert.equal(callbacks.size, 1);
  const firstCallback = callbacks.get(1);
  callbacks.delete(1);
  firstCallback?.(0);
  assert.deepEqual(flushed, [2]);

  batcher.schedule(3);
  batcher.cancel();
  assert.deepEqual(cancelled, [2]);
  assert.deepEqual(flushed, [2]);

  batcher.dispose();
  batcher.schedule(4);
  assert.equal(callbacks.size, 0);
});
