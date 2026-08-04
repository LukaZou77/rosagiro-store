import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Worker } from "tesseract.js";
import {
  collectSensitiveRegions,
  expandAndClampRegion,
  type OcrLine,
  type SensitiveRegion
} from "./tray-image-redaction-core";

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export type SanitizedTrayImageResult = {
  outputPath: string;
  detected: SensitiveRegion[];
  residual: SensitiveRegion[];
  passedAutomatedCheck: boolean;
};

function scaledBox(box: OcrLine["bbox"], scale: number) {
  return {
    x0: Math.round(box.x0 / scale),
    y0: Math.round(box.y0 / scale),
    x1: Math.round(box.x1 / scale),
    y1: Math.round(box.y1 / scale)
  };
}

function tesseractLines(data: Awaited<ReturnType<Worker["recognize"]>>["data"], scale: number): OcrLine[] {
  const lines: OcrLine[] = [];
  for (const block of data.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        lines.push({
          text: line.text,
          confidence: line.confidence,
          bbox: scaledBox(line.bbox, scale),
          words: (line.words || []).map((word) => ({
            text: word.text,
            confidence: word.confidence,
            bbox: scaledBox(word.bbox, scale)
          }))
        });
      }
    }
  }
  return lines;
}

async function recognize(worker: Worker, image: Buffer | string) {
  const source = typeof image === "string" ? await fs.readFile(image) : image;
  const normalized = await sharp(source).autoOrient().toBuffer();
  const metadata = await sharp(normalized).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (!width || !height) return [];
  const scale = Math.max(1, Math.min(2, 2600 / width, 2600 / height));
  const baseResult = await worker.recognize(normalized, {}, { text: true, blocks: true });
  const lines = tesseractLines(baseResult.data, 1);

  // Supplier cards often render costs as white text inside a red badge. The
  // inverted threshold makes those labels black on white without changing the
  // customer-facing image that is ultimately written.
  const invertedCostText = await sharp(normalized)
    .grayscale()
    .normalize()
    .threshold(175)
    .negate()
    .png()
    .toBuffer();
  const invertedResult = await worker.recognize(invertedCostText, {}, { text: true, blocks: true });
  lines.push(...tesseractLines(invertedResult.data, 1));
  if (scale === 1) return lines;

  const prepared = await sharp(normalized)
    .resize(Math.round(width * scale), Math.round(height * scale))
    .sharpen()
    .jpeg({ quality: 95 })
    .toBuffer();
  const scaledResult = await worker.recognize(prepared, {}, { text: true, blocks: true });
  return [...lines, ...tesseractLines(scaledResult.data, scale)];
}

function meanColor(stats: Awaited<ReturnType<sharp.Sharp["stats"]>>): RgbColor {
  const channels = stats.channels.slice(0, 3);
  return {
    r: Math.round(channels[0]?.mean || 248),
    g: Math.round(channels[1]?.mean || 246),
    b: Math.round(channels[2]?.mean || 243)
  };
}

async function sampleRegionColor(image: Buffer, region: SensitiveRegion, imageWidth: number, imageHeight: number) {
  const x0 = Math.max(0, Math.floor(region.x0));
  const y0 = Math.max(0, Math.floor(region.y0));
  const x1 = Math.min(imageWidth, Math.ceil(region.x1));
  const y1 = Math.min(imageHeight, Math.ceil(region.y1));
  const width = Math.max(1, x1 - x0);
  const height = Math.max(1, y1 - y0);
  const strip = Math.min(8, Math.max(2, Math.round(Math.min(width, height) / 4)));

  const samples = [
    y0 >= strip ? { left: x0, top: y0 - strip, width, height: strip } : null,
    y1 + strip <= imageHeight ? { left: x0, top: y1, width, height: strip } : null,
    x0 >= strip ? { left: x0 - strip, top: y0, width: strip, height } : null,
    x1 + strip <= imageWidth ? { left: x1, top: y0, width: strip, height } : null
  ].filter((sample): sample is NonNullable<typeof sample> => Boolean(sample));

  if (!samples.length) return { r: 248, g: 246, b: 243 };
  const colors = await Promise.all(samples.map((sample) => sharp(image).extract(sample).stats().then(meanColor)));
  return {
    r: Math.round(colors.reduce((sum, color) => sum + color.r, 0) / colors.length),
    g: Math.round(colors.reduce((sum, color) => sum + color.g, 0) / colors.length),
    b: Math.round(colors.reduce((sum, color) => sum + color.b, 0) / colors.length)
  };
}

function rectangleSvg(width: number, height: number, color: RgbColor) {
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="rgb(${color.r},${color.g},${color.b})"/></svg>`
  );
}

async function recognizeWithWorkers(workers: Worker | Worker[], image: Buffer | string) {
  const workerList = Array.isArray(workers) ? workers : [workers];
  return (await Promise.all(workerList.map((worker) => recognize(worker, image)))).flat();
}

export async function inspectImageForSensitiveText(workers: Worker | Worker[], imagePath: string) {
  return collectSensitiveRegions(await recognizeWithWorkers(workers, imagePath));
}

export async function sanitizeTrayImage({
  inputPath,
  outputPath,
  workers
}: {
  inputPath: string;
  outputPath: string;
  workers: Worker | Worker[];
}): Promise<SanitizedTrayImageResult> {
  const normalized = await sharp(inputPath).autoOrient().jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toBuffer();
  const metadata = await sharp(normalized).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (!width || !height) throw new Error(`Could not read image dimensions: ${inputPath}`);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const detected = collectSensitiveRegions(await recognizeWithWorkers(workers, normalized)).map((region) =>
    expandAndClampRegion(region, width, height)
  );
  let currentImage = normalized;
  let pendingRegions = detected;
  const allDetected = [...detected];
  let residual: SensitiveRegion[] = [];

  for (let pass = 0; pass < 2; pass += 1) {
    const overlays = await Promise.all(
      pendingRegions.map(async (region) => {
        const overlayWidth = Math.max(1, region.x1 - region.x0);
        const overlayHeight = Math.max(1, region.y1 - region.y0);
        const color = await sampleRegionColor(currentImage, region, width, height);
        return {
          input: rectangleSvg(overlayWidth, overlayHeight, color),
          left: region.x0,
          top: region.y0
        };
      })
    );
    currentImage = await sharp(currentImage)
      .composite(overlays)
      .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
      .toBuffer();
    await fs.writeFile(outputPath, currentImage);
    residual = collectSensitiveRegions(await recognizeWithWorkers(workers, currentImage));
    if (!residual.length) break;
    pendingRegions = residual.map((region) => expandAndClampRegion(region, width, height));
    allDetected.push(...pendingRegions);
  }

  return {
    outputPath,
    detected: allDetected,
    residual,
    passedAutomatedCheck: allDetected.length > 0 && residual.length === 0
  };
}
