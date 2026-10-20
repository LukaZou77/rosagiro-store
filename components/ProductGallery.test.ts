import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { isSourceBoardImage } from "./OptimizedProductImage";
import * as performance from "./ProductGalleryPerformance";
import { isProductPackageImage } from "../lib/product-package-images";

type GalleryNode = { type: unknown; props: Record<string, unknown> };
const source = readFileSync(new URL("./ProductGallery.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }
}).outputText;
const restoredBoard = `https://store.public.blob.vercel-storage.com/products/boards/source-123/${"a".repeat(64)}.jpg`;
const boards = ["/uploads/package-model.jpg", "/uploads/package-clean-model.webp?cache=1", restoredBoard];

// Exercise the real component handlers with deterministic hooks, without a DOM or browser.
function mountGallery(images: string[]) {
  const slots: unknown[] = [];
  let cursor = 0;
  function slot(initial: unknown) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return index;
  }
  const jsx = (type: unknown, props: Record<string, unknown>): GalleryNode => ({ type, props });
  const exports: Record<string, (props: Record<string, unknown>) => GalleryNode> = {};
  const modules: Record<string, unknown> = {
    react: {
      useState(initial: unknown) {
        const index = slot(initial);
        return [slots[index], (next: unknown) => {
          slots[index] = typeof next === "function" ? next(slots[index]) : next;
        }];
      },
      useRef(initial: unknown) { return slots[slot({ current: initial })]; },
      useMemo: (callback: () => unknown) => callback(),
      useCallback: (callback: unknown) => callback,
      useEffect: () => {}
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": { PackageCheck: "PackageCheck" },
    "@/components/OptimizedProductImage": { isSourceBoardImage, OptimizedProductImage: "Image" },
    "@/components/ProductGalleryPerformance": performance,
    "@/lib/product-package-images": { isProductPackageImage }
  };
  runInNewContext(compiled, {
    exports,
    require(name: string) {
      assert.ok(name in modules, `Unexpected import: ${name}`);
      return modules[name];
    },
    window: {
      matchMedia: (query: string) => ({ matches: !query.includes("reduced-motion") }),
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {}
    }
  });
  const carousel = exports.ProductGallery({ images, productName: "Produto" });
  assert.equal(typeof carousel.type, "function");
  return () => {
    cursor = 0;
    return (carousel.type as (props: Record<string, unknown>) => GalleryNode)(carousel.props);
  };
}

function nodes(node: GalleryNode, className: string): GalleryNode[] {
  const children = [node.props.children].flat(Infinity).filter((child): child is GalleryNode => Boolean(child && typeof child === "object" && "props" in child));
  return [
    ...(String(node.props.className || "").split(/\s+/).includes(className) ? [node] : []),
    ...children.flatMap((child) => nodes(child, className))
  ];
}

function invoke(node: GalleryNode, handler: string, event?: unknown) {
  assert.equal(typeof node.props[handler], "function");
  (node.props[handler] as (event?: unknown) => void)(event);
}

for (const board of boards) {
  test(`board stays unzoomed and moves controls outside the original frame: ${board}`, () => {
    const render = mountGallery([board, "/photo.jpg"]);
    let tree = render();
    const main = nodes(tree, "product-gallery-main")[0];
    assert.ok(nodes(main, "source-board-main").length);
    assert.equal(nodes(main, "product-gallery-count").length, 0);
    assert.equal(nodes(main, "product-gallery-package-badge").length, 0);
    assert.equal(nodes(main, "product-gallery-zoom-hint").length, 0);
    assert.equal(nodes(tree, "product-gallery-thumb-package").length, 0);
    assert.equal(nodes(tree, "board-thumb").length, 1);
    const metadata = nodes(tree, "product-gallery-board-meta")[0];
    assert.equal(nodes(metadata, "product-gallery-count").length, 1);
    assert.equal(nodes(metadata, "product-board-original-link")[0].props.href, board);

    (main.props.ref as { current: unknown }).current = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 })
    };
    const pointer = { pointerType: "mouse", isPrimary: true, clientX: 30, clientY: 40 };
    invoke(main, "onPointerEnter", pointer);
    invoke(main, "onPointerMove", pointer);
    tree = render();
    assert.equal(nodes(tree, "zooming").length, 0);

    invoke(nodes(tree, "product-gallery-main")[0], "onClick");
    tree = render();
    const lightbox = nodes(tree, "board-lightbox")[0];
    assert.ok(lightbox);
    assert.equal(nodes(lightbox, "product-lightbox-arrow").length, 2);
    assert.equal(nodes(lightbox, "product-board-original-link")[0].props.href, board);
    assert.equal(nodes(lightbox, "product-gallery-thumb-package").length, 0);
    invoke(nodes(lightbox, "next")[0], "onClick");
    assert.equal(nodes(render(), "board-lightbox").length, 0);
  });
}

test("a single board retains original access without carousel overlays", () => {
  const render = mountGallery([restoredBoard]);
  let tree = render();
  assert.equal(nodes(tree, "product-gallery-arrow").length, 0);
  assert.equal(nodes(tree, "product-gallery-count").length, 0);
  invoke(nodes(tree, "product-gallery-main")[0], "onClick");
  tree = render();
  const lightbox = nodes(tree, "board-lightbox")[0];
  assert.equal(nodes(lightbox, "product-lightbox-arrow").length, 0);
  assert.equal(nodes(lightbox, "product-board-original-link")[0].props.href, restoredBoard);
});

test("ordinary photos retain hover zoom and reset when selecting a board", () => {
  const render = mountGallery(["/photo.jpg", boards[0]]);
  const tree = render();
  const main = nodes(tree, "product-gallery-main")[0];
  (main.props.ref as { current: unknown }).current = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 })
  };
  invoke(main, "onPointerMove", { pointerType: "mouse", isPrimary: true, clientX: 50, clientY: 50 });
  assert.equal(nodes(render(), "zooming").length, 1);
  invoke(nodes(tree, "board-thumb")[0], "onClick");
  assert.equal(nodes(render(), "zooming").length, 0);
  assert.equal(nodes(render(), "source-board-main").length, 1);
});

test("board CSS contains originals and separates navigation on desktop and mobile", () => {
  assert.match(css, /\.product-gallery-main\.source-board-main \.product-gallery-image\s*\{\s*object-fit: contain;\s*transform: none;\s*transition: none;/);
  assert.match(css, /\.product-gallery-main\.zooming:not\(\.source-board-main\)/);
  assert.match(css, /\.board-viewer \.product-gallery-arrow\s*\{\s*position: static;\s*transform: none;/);
  assert.match(css, /\.product-gallery-board-meta \.product-gallery-count\s*\{\s*position: static;/);
  assert.match(css, /\.product-lightbox-thumbs img\.source-board-image\s*\{\s*object-fit: contain;/);
  assert.match(css, /\.board-lightbox\.has-carousel \.product-lightbox-stage\s*\{[^}]*grid-template-rows: minmax\(0, 1fr\) 48px;/);
  assert.match(css, /\.board-lightbox \.product-lightbox-arrow\s*\{\s*position: static;\s*transform: none;/);
  assert.match(css, /\.board-lightbox \.product-lightbox-image\s*\{\s*max-height: none;/);
});
