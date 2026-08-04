import assert from "node:assert/strict";
import test from "node:test";
import { collectSensitiveRegions, expandAndClampRegion, type OcrLine } from "./tray-image-redaction-core";

const lines: OcrLine[] = [
  {
    text: "Uni 6.42",
    confidence: 90,
    bbox: { x0: 10, y0: 10, x1: 100, y1: 30 },
    words: [
      { text: "Uni", confidence: 92, bbox: { x0: 10, y0: 10, x1: 40, y1: 30 } },
      { text: "6.42", confidence: 91, bbox: { x0: 45, y0: 10, x1: 100, y1: 30 } }
    ]
  },
  {
    text: "Box 51.40c/8pcs",
    confidence: 88,
    bbox: { x0: 10, y0: 50, x1: 160, y1: 72 },
    words: [
      { text: "Box", confidence: 94, bbox: { x0: 10, y0: 50, x1: 40, y1: 72 } },
      { text: "51.40c/8pcs", confidence: 80, bbox: { x0: 45, y0: 50, x1: 160, y1: 72 } }
    ]
  },
  {
    text: "批发价",
    confidence: 87,
    bbox: { x0: 200, y0: 20, x1: 260, y1: 45 },
    words: [{ text: "批发价", confidence: 87, bbox: { x0: 200, y0: 20, x1: 260, y1: 45 } }]
  }
];

test("detects unit cost, package cost and Chinese supplier text", () => {
  const regions = collectSensitiveRegions(lines);
  assert.deepEqual(
    regions.flatMap((region) => region.reasons).sort(),
    ["chinese-text", "package-cost", "unit-cost"]
  );
});

test("does not treat thin OCR artifacts as Chinese supplier text", () => {
  const regions = collectSensitiveRegions([
    {
      text: "一 product",
      confidence: 80,
      bbox: { x0: 0, y0: 0, x1: 100, y1: 20 },
      words: [
        { text: "一", confidence: 95, bbox: { x0: 2, y0: 10, x1: 60, y1: 11 } },
        { text: "product", confidence: 90, bbox: { x0: 65, y0: 0, x1: 100, y1: 20 } }
      ]
    }
  ]);
  assert.equal(regions.length, 0);
});

test("does not automatically paint isolated Chinese-shaped OCR artifacts", () => {
  const regions = collectSensitiveRegions([
    {
      text: "一 一 人",
      confidence: 91,
      bbox: { x0: 0, y0: 0, x1: 100, y1: 30 },
      words: [
        { text: "一", confidence: 95, bbox: { x0: 2, y0: 2, x1: 20, y1: 20 } },
        { text: "一", confidence: 95, bbox: { x0: 30, y0: 2, x1: 48, y1: 20 } },
        { text: "人", confidence: 95, bbox: { x0: 60, y0: 2, x1: 78, y1: 20 } }
      ]
    }
  ]);
  assert.equal(regions.length, 0);
});

test("expands redaction boxes without exceeding the image", () => {
  assert.deepEqual(
    expandAndClampRegion(
      { x0: 3, y0: 4, x1: 95, y1: 98, reasons: ["unit-cost"], evidence: ["Uni 6.42"] },
      100,
      100,
      8
    ),
    { x0: 0, y0: 0, x1: 100, y1: 100, reasons: ["unit-cost"], evidence: ["Uni 6.42"] }
  );
});

test("extends cost redactions across trailing package-count text", () => {
  assert.deepEqual(
    expandAndClampRegion(
      { x0: 20, y0: 10, x1: 120, y1: 40, reasons: ["package-cost"], evidence: ["Box 280.80"] },
      400,
      200,
      8
    ),
    { x0: 12, y0: 2, x1: 200, y1: 48, reasons: ["package-cost"], evidence: ["Box 280.80"] }
  );
});

test("detects total cost lines without removing package quantity lines", () => {
  const findings = collectSensitiveRegions([
    {
      text: "Box com: 24 uni.",
      confidence: 90,
      bbox: { x0: 10, y0: 10, x1: 165, y1: 30 },
      words: [
        { text: "Box", confidence: 90, bbox: { x0: 10, y0: 10, x1: 50, y1: 30 } },
        { text: "com:", confidence: 90, bbox: { x0: 55, y0: 10, x1: 95, y1: 30 } },
        { text: "24", confidence: 90, bbox: { x0: 100, y0: 10, x1: 125, y1: 30 } },
        { text: "uni.", confidence: 90, bbox: { x0: 130, y0: 10, x1: 165, y1: 30 } }
      ]
    },
    {
      text: "Box com: 24 uni. Total:R$95,76",
      confidence: 90,
      bbox: { x0: 10, y0: 40, x1: 390, y1: 62 },
      words: [
        { text: "Box", confidence: 90, bbox: { x0: 10, y0: 40, x1: 50, y1: 62 } },
        { text: "com:", confidence: 90, bbox: { x0: 55, y0: 40, x1: 95, y1: 62 } },
        { text: "24", confidence: 90, bbox: { x0: 100, y0: 40, x1: 125, y1: 62 } },
        { text: "uni.", confidence: 90, bbox: { x0: 130, y0: 40, x1: 165, y1: 62 } },
        { text: "Total:R$95,76", confidence: 90, bbox: { x0: 250, y0: 40, x1: 390, y1: 62 } }
      ]
    }
  ]);

  assert.equal(findings.length, 1);
  assert.deepEqual(findings[0].reasons, ["package-cost"]);
  assert.match(findings[0].evidence[0], /95,76/);
  assert.equal(findings[0].x0, 250);
});

test("detects price markers joined to their amount", () => {
  const findings = collectSensitiveRegions([
    {
      text: "TS5505004 | Uni3.80",
      confidence: 90,
      bbox: { x0: 10, y0: 10, x1: 280, y1: 42 },
      words: [
        { text: "TS5505004", confidence: 92, bbox: { x0: 10, y0: 10, x1: 140, y1: 42 } },
        { text: "|", confidence: 80, bbox: { x0: 150, y0: 10, x1: 156, y1: 42 } },
        { text: "Uni3.80", confidence: 94, bbox: { x0: 180, y0: 10, x1: 280, y1: 42 } }
      ]
    }
  ]);

  assert.equal(findings.length, 1);
  assert.deepEqual(findings[0].reasons, ["unit-cost"]);
  assert.equal(findings[0].x0, 180);
  assert.equal(findings[0].x1, 280);
});
