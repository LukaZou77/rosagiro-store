export type OcrBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type OcrWord = {
  text: string;
  confidence: number;
  bbox: OcrBox;
};

export type OcrLine = {
  text: string;
  confidence: number;
  bbox: OcrBox;
  words: OcrWord[];
};

export type SensitiveRegion = OcrBox & {
  reasons: Array<"unit-cost" | "package-cost" | "chinese-text">;
  evidence: string[];
};

const PRICE_MARKERS = /^(?:[uj]ni(?:dade)?|unit|unitario|unitaria|box|caixa)$/i;
const PACKAGE_MARKERS = /^(?:box|caixa)$/i;
const CJK_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;

function normalizedWord(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
}

function includesPriceDetails(value: string) {
  return /\d|r\$|reais|pcs|un(?:id)?|\//i.test(value);
}

function includesStrongPackageCost(value: string) {
  return /\d+[.,]\d+|r\$|reais|pcs|\/\s*\d/i.test(value);
}

function boxWidth(box: OcrBox) {
  return Math.max(0, box.x1 - box.x0);
}

function unionBox(boxes: OcrBox[]): OcrBox {
  return {
    x0: Math.min(...boxes.map((box) => box.x0)),
    y0: Math.min(...boxes.map((box) => box.y0)),
    x1: Math.max(...boxes.map((box) => box.x1)),
    y1: Math.max(...boxes.map((box) => box.y1))
  };
}

function likelyChineseWord(word: OcrWord) {
  const cjkCount = word.text.match(CJK_PATTERN)?.length || 0;
  return cjkCount >= 2 && word.confidence >= 35;
}

function boxesTouch(left: OcrBox, right: OcrBox, gap = 10) {
  return !(
    left.x1 + gap < right.x0 ||
    right.x1 + gap < left.x0 ||
    left.y1 + gap < right.y0 ||
    right.y1 + gap < left.y0
  );
}

function mergeRegions(regions: SensitiveRegion[]) {
  const merged: SensitiveRegion[] = [];

  for (const region of regions) {
    const target = merged.find((candidate) => boxesTouch(candidate, region));
    if (!target) {
      merged.push({ ...region, reasons: [...region.reasons], evidence: [...region.evidence] });
      continue;
    }

    const combined = unionBox([target, region]);
    target.x0 = combined.x0;
    target.y0 = combined.y0;
    target.x1 = combined.x1;
    target.y1 = combined.y1;
    target.reasons = Array.from(new Set([...target.reasons, ...region.reasons]));
    target.evidence = Array.from(new Set([...target.evidence, ...region.evidence]));
  }

  return merged;
}

export function collectSensitiveRegions(lines: OcrLine[]) {
  const regions: SensitiveRegion[] = [];

  for (const line of lines) {
    for (let index = 0; index < line.words.length; index += 1) {
      const word = line.words[index];
      const marker = normalizedWord(word.text);

      if (PRICE_MARKERS.test(marker)) {
        const selected = [word];
        for (const candidate of line.words.slice(index + 1, index + 4)) {
          if (!includesPriceDetails(candidate.text)) break;
          selected.push(candidate);
        }
        const isPackageMarker = PACKAGE_MARKERS.test(marker);
        const evidence = selected.map((item) => item.text).join(" ");
        if (selected.length > 1 && (!isPackageMarker || includesStrongPackageCost(evidence))) {
          const box = unionBox(selected.map((item) => item.bbox));
          regions.push({
            ...box,
            reasons: [isPackageMarker ? "package-cost" : "unit-cost"],
            evidence: [evidence]
          });
        }
      }

      if (likelyChineseWord(word)) {
        regions.push({
          ...word.bbox,
          reasons: ["chinese-text"],
          evidence: [word.text]
        });
      }
    }
  }

  return mergeRegions(regions);
}

export function expandAndClampRegion(region: SensitiveRegion, width: number, height: number, padding = 8) {
  const horizontalPadding = region.reasons.includes("package-cost")
    ? Math.max(padding, Math.round(boxWidth(region) * 0.8))
    : padding;
  return {
    ...region,
    x0: Math.max(0, Math.floor(region.x0 - padding)),
    y0: Math.max(0, Math.floor(region.y0 - padding)),
    x1: Math.min(width, Math.ceil(region.x1 + horizontalPadding)),
    y1: Math.min(height, Math.ceil(region.y1 + padding))
  };
}
