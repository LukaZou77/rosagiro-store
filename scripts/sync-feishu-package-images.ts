import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";
import { PrismaClient } from "../src/generated/prisma/client";
import { isProductPackageImage } from "../lib/product-package-images";
import { inspectImageForSensitiveText, sanitizeTrayImage } from "./lib/tray-image-redaction";

type Mode = "audit" | "prepare" | "apply-reviewed";
type SourceFilter = "all" | "package" | "tray";

type SheetInfo = {
  sheetId: string;
  title: string;
};

type FeishuRow = {
  rowNumber: number;
  brand: string;
  model: string;
  packageToken: string;
  trayToken: string;
};

type FeishuGroup = {
  key: string;
  brand: string;
  mainModel: string;
  packageToken: string;
  trayToken: string;
  rows: number[];
};

type ProductRecord = {
  id: string;
  slug: string;
  name: string;
  image: string;
  gallery: string[];
  trayImage: string | null;
  brand: { name: string };
  skus: Array<{ code: string }>;
};

type Candidate = {
  product: ProductRecord;
  group: FeishuGroup | null;
  status: "already-public" | "package-source" | "tray-fallback" | "no-source" | "ambiguous";
  reason: string;
};

type ReviewItem = {
  approved: boolean;
  slug: string;
  model: string;
  sourceType: "package" | "sanitized-tray";
  originalFile: string;
  preparedFile: string;
  automatedCheck: "passed" | "needs-review";
  findings: string[];
  residualFindings: string[];
  notes: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const DEFAULT_SPREADSHEET_TOKEN = "BoyiswTjkhtGJXtiOCVc3jGxn3c";
const DEFAULT_SHEET_TITLE = "商品录入";
const DEFAULT_RANGE = "A1:L8000";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string, fallback = "") => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] || fallback : fallback;
  };
  const mode = get("--mode", "audit") as Mode;
  if (!(["audit", "prepare", "apply-reviewed"] as Mode[]).includes(mode)) {
    throw new Error("--mode must be audit, prepare or apply-reviewed.");
  }
  const rawLimit = Number(get("--limit", mode === "prepare" ? "10" : "0"));
  if (!Number.isInteger(rawLimit) || rawLimit < 0) throw new Error("--limit must be a non-negative integer.");
  const source = get("--source", "all") as SourceFilter;
  if (!(["all", "package", "tray"] as SourceFilter[]).includes(source)) {
    throw new Error("--source must be all, package or tray.");
  }
  return {
    mode,
    source,
    limit: rawLimit,
    yes: args.includes("--yes"),
    reviewedJson: get("--reviewed-json"),
    reportDir: get("--report-dir"),
    onlySlugs: new Set(get("--only-slugs").split(",").map((value) => value.trim()).filter(Boolean))
  };
}

async function loadEnvFile(filePath: string) {
  const content = await fs.readFile(filePath, "utf8").catch(() => "");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function feishuRequest<T>(method: "GET" | "POST", pathOrUrl: string, token?: string, body?: unknown): Promise<T> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `https://open.feishu.cn/open-apis${pathOrUrl}`;
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = (await response.json()) as { code?: number; msg?: string };
  if (!response.ok || json.code !== 0) {
    throw new Error(`Feishu API failed: HTTP ${response.status}, code ${json.code}, msg ${json.msg}`);
  }
  return json as T;
}

async function getTenantAccessToken() {
  const response = await feishuRequest<{ tenant_access_token?: string }>(
    "POST",
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    undefined,
    { app_id: requireEnv("FEISHU_APP_ID"), app_secret: requireEnv("FEISHU_APP_SECRET") }
  );
  if (!response.tenant_access_token) throw new Error("Feishu did not return a tenant access token.");
  return response.tenant_access_token;
}

async function querySheets(spreadsheetToken: string, token: string) {
  const result = await feishuRequest<{ data?: { sheets?: Array<Record<string, unknown>> } }>(
    "GET",
    `/sheets/v3/spreadsheets/${spreadsheetToken}/sheets/query`,
    token
  );
  return (result.data?.sheets || []).map((sheet): SheetInfo => ({
    sheetId: String(sheet.sheet_id || ""),
    title: String(sheet.title || "")
  }));
}

async function readRange(spreadsheetToken: string, sheetId: string, token: string) {
  const encodedRange = encodeURIComponent(`${sheetId}!${DEFAULT_RANGE}`);
  const result = await feishuRequest<{ data?: { valueRange?: { values?: unknown[][] } } }>(
    "GET",
    `/sheets/v2/spreadsheets/${spreadsheetToken}/values/${encodedRange}?valueRenderOption=FormattedValue&dateTimeRenderOption=FormattedString`,
    token
  );
  return result.data?.valueRange?.values || [];
}

function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["text", "value", "link", "url"]) {
      if (typeof record[key] === "string") return String(record[key]).trim();
    }
  }
  return "";
}

function fileToken(value: unknown) {
  if (value && typeof value === "object" && typeof (value as Record<string, unknown>).fileToken === "string") {
    return String((value as Record<string, unknown>).fileToken);
  }
  return "";
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function normalizeCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9.-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
}

function mainModel(value: string) {
  const code = normalizeCode(value);
  const parts = code.split("-").filter(Boolean);
  const colorNames = new Set(["PRETO", "BRANCO", "ROSA", "NUDE", "MARROM", "VERMELHO", "LILAS", "AZUL", "VERDE"]);
  const isVariant = (suffix: string) => /^\d{1,3}$/.test(suffix) || /^[A-Z]{1,4}\d{1,3}$/.test(suffix) || colorNames.has(suffix);
  if (parts.length >= 3 && isVariant(parts.at(-1) || "")) return parts.slice(0, -1).join("-");
  if (parts.length === 2 && /\d/.test(parts[0]) && isVariant(parts[1])) return parts[0];
  return code;
}

function groupKey(brand: string, model: string) {
  return `${normalizeKey(brand)}|${mainModel(model)}`;
}

function parseFeishuGroups(values: unknown[][]) {
  const headerIndex = values.findIndex((row) => cellText(row[1]).includes("品牌") && cellText(row[3]).includes("型号"));
  if (headerIndex < 0) throw new Error("Could not locate the Feishu product header row.");
  const rows: FeishuRow[] = [];
  for (let index = headerIndex + 1; index < values.length; index += 1) {
    const row = values[index] || [];
    const brand = cellText(row[1]);
    const model = cellText(row[3]);
    if (!brand || !model) continue;
    rows.push({
      rowNumber: index + 1,
      brand,
      model,
      trayToken: fileToken(row[7]),
      packageToken: fileToken(row[9])
    });
  }

  const groups = new Map<string, FeishuGroup>();
  for (const row of rows) {
    const key = groupKey(row.brand, row.model);
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row.rowNumber);
      existing.packageToken ||= row.packageToken;
      existing.trayToken ||= row.trayToken;
    } else {
      groups.set(key, {
        key,
        brand: row.brand,
        mainModel: mainModel(row.model),
        packageToken: row.packageToken,
        trayToken: row.trayToken,
        rows: [row.rowNumber]
      });
    }
  }
  return groups;
}

function createPrismaClient() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: requireEnv("DATABASE_URL") }) });
}

async function loadProducts(prisma: PrismaClient): Promise<ProductRecord[]> {
  return prisma.product.findMany({
    where: { active: true, deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      image: true,
      gallery: true,
      trayImage: true,
      brand: { select: { name: true } },
      skus: { where: { active: true }, select: { code: true } }
    },
    orderBy: { slug: "asc" }
  });
}

function matchProducts(products: ProductRecord[], groups: Map<string, FeishuGroup>) {
  return products.map((product): Candidate => {
    if (product.gallery.some(isProductPackageImage)) {
      return { product, group: null, status: "already-public", reason: "reviewed package image already in gallery" };
    }
    const matches = new Map<string, FeishuGroup>();
    for (const sku of product.skus) {
      const group = groups.get(groupKey(product.brand.name, sku.code));
      if (group) matches.set(group.key, group);
    }
    if (matches.size > 1) {
      return { product, group: null, status: "ambiguous", reason: `${matches.size} Feishu product groups matched active SKUs` };
    }
    const group = Array.from(matches.values())[0] || null;
    if (group?.packageToken) return { product, group, status: "package-source", reason: "complete package image in Feishu" };
    if (group?.trayToken || product.trayImage) {
      return { product, group, status: "tray-fallback", reason: "tray image requires sanitizing and review" };
    }
    return { product, group, status: "no-source", reason: "no complete package image or internal tray image" };
  });
}

async function downloadFeishuMedia(token: string, tenantToken: string, outputPath: string) {
  const response = await fetch(`https://open.feishu.cn/open-apis/drive/v1/medias/${encodeURIComponent(token)}/download`, {
    headers: { Authorization: `Bearer ${tenantToken}`, "User-Agent": "Mozilla/5.0" }
  });
  if (!response.ok) throw new Error(`Could not download Feishu media ${token}: HTTP ${response.status}`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
}

async function downloadUrl(url: string, outputPath: string) {
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`Could not download tray image: HTTP ${response.status}`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
}

function safeFilePart(value: string) {
  return normalizeCode(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "package";
}

function timestampLabel() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function writeCsv(filePath: string, rows: unknown[][]) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, rows.map((row) => row.map(csvValue).join(",")).join("\n"), "utf8");
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function findingLabels(findings: Array<{ reasons: string[]; evidence: string[] }>) {
  return findings.flatMap((finding) => finding.reasons.map((reason) => `${reason}: ${finding.evidence.join(" ")}`));
}

async function createOcrWorkers() {
  const cachePath = path.join(repoRoot, "output", "tesseract-cache");
  await fs.mkdir(cachePath, { recursive: true });
  const workerOptions = { cachePath };
  const costAutoWorker = await createWorker("eng", undefined, workerOptions);
  const costSparseWorker = await createWorker("eng", undefined, workerOptions);
  const chineseWorker = await createWorker(["eng", "chi_sim"], undefined, workerOptions);
  for (const worker of [costSparseWorker, chineseWorker]) {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: "1"
    });
  }
  return [costAutoWorker, costSparseWorker, chineseWorker];
}

async function writeAuditReport(reportDir: string, candidates: Candidate[]) {
  const rows: unknown[][] = [["slug", "product", "brand", "status", "reason", "feishuRows"]];
  for (const candidate of candidates) {
    rows.push([
      candidate.product.slug,
      candidate.product.name,
      candidate.product.brand.name,
      candidate.status,
      candidate.reason,
      candidate.group?.rows.join("|") || ""
    ]);
  }
  await writeCsv(path.join(reportDir, "audit.csv"), rows);
}

async function prepareCandidates(candidates: Candidate[], tenantToken: string, reportDir: string) {
  const workers = await createOcrWorkers();
  const reviews: ReviewItem[] = [];
  try {
    for (const candidate of candidates) {
      const model = candidate.group?.mainModel || mainModel(candidate.product.skus[0]?.code || candidate.product.slug);
      const itemDir = path.join(reportDir, "candidates", candidate.product.slug);
      const originalFile = path.join(itemDir, "original.jpg");
      const preparedFile = path.join(itemDir, `package-clean-${safeFilePart(model)}.jpg`);
      await fs.mkdir(itemDir, { recursive: true });

      if (candidate.status === "package-source" && candidate.group?.packageToken) {
        await downloadFeishuMedia(candidate.group.packageToken, tenantToken, originalFile);
        const findings = await inspectImageForSensitiveText(workers, originalFile);
        if (findings.length) {
          const result = await sanitizeTrayImage({ inputPath: originalFile, outputPath: preparedFile, workers });
          reviews.push({
            approved: false,
            slug: candidate.product.slug,
            model,
            sourceType: "package",
            originalFile,
            preparedFile,
            automatedCheck: result.passedAutomatedCheck ? "passed" : "needs-review",
            findings: findingLabels(result.detected),
            residualFindings: findingLabels(result.residual),
            notes: "Complete package source contained supplier text; inspect the cleaned copy."
          });
        } else {
          await sharp(originalFile).autoOrient().jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toFile(preparedFile);
          reviews.push({
            approved: false,
            slug: candidate.product.slug,
            model,
            sourceType: "package",
            originalFile,
            preparedFile,
            automatedCheck: "passed",
            findings: [],
            residualFindings: [],
            notes: "No cost or likely Chinese text detected. Visual approval is still required."
          });
        }
        continue;
      }

      if (candidate.status === "tray-fallback" && (candidate.group?.trayToken || candidate.product.trayImage)) {
        if (candidate.group?.trayToken) {
          await downloadFeishuMedia(candidate.group.trayToken, tenantToken, originalFile);
        } else {
          await downloadUrl(candidate.product.trayImage as string, originalFile);
        }
        const result = await sanitizeTrayImage({ inputPath: originalFile, outputPath: preparedFile, workers });
        reviews.push({
          approved: false,
          slug: candidate.product.slug,
          model,
          sourceType: "sanitized-tray",
          originalFile,
          preparedFile,
          automatedCheck: "needs-review",
          findings: findingLabels(result.detected),
          residualFindings: findingLabels(result.residual),
          notes: "Tray fallback always requires visual approval before publishing."
        });
      }
    }
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
  return reviews;
}

async function writeReviewReport(reportDir: string, reviews: ReviewItem[]) {
  await fs.writeFile(path.join(reportDir, "review.json"), `${JSON.stringify(reviews, null, 2)}\n`, "utf8");
  await writeCsv(path.join(reportDir, "preview.csv"), [
    ["approved", "slug", "model", "sourceType", "automatedCheck", "findings", "residualFindings", "preparedFile"],
    ...reviews.map((item) => [
      item.approved,
      item.slug,
      item.model,
      item.sourceType,
      item.automatedCheck,
      item.findings.join(" | "),
      item.residualFindings.join(" | "),
      item.preparedFile
    ])
  ]);

  const cards = reviews.map((item) => {
    const original = path.relative(reportDir, item.originalFile).replace(/\\/g, "/");
    const prepared = path.relative(reportDir, item.preparedFile).replace(/\\/g, "/");
    return `<article><h2>${escapeHtml(item.slug)}</h2><p><strong>${escapeHtml(item.sourceType)}</strong> / ${escapeHtml(item.automatedCheck)}</p><div class="images"><figure><img src="${escapeHtml(original)}" alt=""><figcaption>Original interno</figcaption></figure><figure><img src="${escapeHtml(prepared)}" alt=""><figcaption>Candidato limpo</figcaption></figure></div><p>Detectado: ${escapeHtml(item.findings.join(" | ") || "nada")}</p><p>Residual: ${escapeHtml(item.residualFindings.join(" | ") || "nada")}</p></article>`;
  }).join("\n");
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Revisao de embalagens</title><style>body{margin:0;padding:24px;background:#f4f3f1;color:#272322;font:14px Arial,sans-serif}main{max-width:1180px;margin:auto}header{margin-bottom:24px}article{padding:18px 0;border-top:1px solid #cfc9c5}.images{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}img{display:block;width:100%;max-height:620px;object-fit:contain;background:white;border:1px solid #d8d2ce}figcaption{padding:6px 0;color:#6e6763}@media(max-width:700px){.images{grid-template-columns:1fr}}</style><main><header><h1>Revisao de imagens de embalagem</h1><p>Nenhuma imagem desta pasta e publicada automaticamente. Compare original e candidato antes de alterar approved para true em review.json.</p></header>${cards}</main></html>`;
  await fs.writeFile(path.join(reportDir, "preview.html"), html, "utf8");
}

async function applyReviewed(prisma: PrismaClient, reviewedJson: string, yes: boolean) {
  if (!yes) throw new Error("apply-reviewed requires --yes.");
  requireEnv("BLOB_READ_WRITE_TOKEN");
  const resolvedReview = path.resolve(reviewedJson);
  const reviewDir = path.dirname(resolvedReview);
  const reviews = JSON.parse(await fs.readFile(resolvedReview, "utf8")) as ReviewItem[];
  const approved = reviews.filter((item) => item.approved);
  const applied: unknown[][] = [["slug", "sourceType", "blobUrl", "result"]];
  const workers = await createOcrWorkers();

  try {
    for (const item of approved) {
      const preparedFile = path.resolve(item.preparedFile);
      if (!preparedFile.startsWith(`${reviewDir}${path.sep}`)) {
        applied.push([item.slug, item.sourceType, "", "rejected: prepared file is outside review directory"]);
        continue;
      }
      if (item.residualFindings.length) {
        applied.push([item.slug, item.sourceType, "", `rejected: review has residual findings (${item.residualFindings.join(" | ")})`]);
        continue;
      }
      const finalFindings = await inspectImageForSensitiveText(workers, preparedFile);
      if (finalFindings.length) {
        applied.push([item.slug, item.sourceType, "", `rejected: final scan found sensitive text (${findingLabels(finalFindings).join(" | ")})`]);
        continue;
      }
      const product = await prisma.product.findUnique({ where: { slug: item.slug }, select: { id: true, slug: true, gallery: true } });
      if (!product) {
        applied.push([item.slug, item.sourceType, "", "skipped: product not found"]);
        continue;
      }
      if (product.gallery.some(isProductPackageImage)) {
        applied.push([item.slug, item.sourceType, "", "skipped: package image already present"]);
        continue;
      }
      if (product.gallery.length >= 9) {
        applied.push([item.slug, item.sourceType, "", "skipped: gallery is full"]);
        continue;
      }
      const fileName = item.sourceType === "sanitized-tray" ? `package-clean-${safeFilePart(item.model)}.jpg` : `package-${safeFilePart(item.model)}.jpg`;
      const blob = await put(`products/${product.slug}/${fileName}`, await fs.readFile(preparedFile), {
        access: "public",
        addRandomSuffix: false,
        contentType: "image/jpeg",
        allowOverwrite: true
      } as Parameters<typeof put>[2] & { allowOverwrite: boolean });
      await prisma.product.update({ where: { id: product.id }, data: { gallery: [...product.gallery, blob.url] } });
      applied.push([item.slug, item.sourceType, blob.url, "applied"]);
    }
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
  await writeCsv(path.join(reviewDir, "applied.csv"), applied);
  return applied.length - 1;
}

async function main() {
  const args = parseArgs();
  await loadEnvFile(path.join(repoRoot, ".env"));
  await loadEnvFile(path.join(repoRoot, ".env.local"));
  await loadEnvFile(path.join(repoRoot, ".env.feishu.local"));
  const prisma = createPrismaClient();

  try {
    if (args.mode === "apply-reviewed") {
      if (!args.reviewedJson) throw new Error("apply-reviewed requires --reviewed-json.");
      const applied = await applyReviewed(prisma, args.reviewedJson, args.yes);
      console.log(JSON.stringify({ mode: args.mode, approvedRowsProcessed: applied }, null, 2));
      return;
    }

    const tenantToken = await getTenantAccessToken();
    const spreadsheetToken = process.env.FEISHU_SPREADSHEET_TOKEN || DEFAULT_SPREADSHEET_TOKEN;
    const sheets = await querySheets(spreadsheetToken, tenantToken);
    const sheet = sheets.find((item) => item.title === DEFAULT_SHEET_TITLE) || sheets[0];
    if (!sheet) throw new Error("No sheet found in the Feishu spreadsheet.");
    const groups = parseFeishuGroups(await readRange(spreadsheetToken, sheet.sheetId, tenantToken));
    const products = await loadProducts(prisma);
    let candidates = matchProducts(products, groups);
    if (args.onlySlugs.size) candidates = candidates.filter((candidate) => args.onlySlugs.has(candidate.product.slug));

    const reportDir = path.resolve(args.reportDir || path.join(repoRoot, "output", "feishu-package-images", timestampLabel()));
    await fs.mkdir(reportDir, { recursive: true });
    await writeAuditReport(reportDir, candidates);
    const summary = Object.fromEntries(
      ["already-public", "package-source", "tray-fallback", "no-source", "ambiguous"].map((status) => [
        status,
        candidates.filter((candidate) => candidate.status === status).length
      ])
    );

    if (args.mode === "prepare") {
      let pending = candidates.filter((candidate) => candidate.status === "package-source" || candidate.status === "tray-fallback");
      if (args.source === "package") pending = pending.filter((candidate) => candidate.status === "package-source");
      if (args.source === "tray") pending = pending.filter((candidate) => candidate.status === "tray-fallback");
      if (args.limit) pending = pending.slice(0, args.limit);
      const reviews = await prepareCandidates(pending, tenantToken, reportDir);
      await writeReviewReport(reportDir, reviews);
      console.log(JSON.stringify({ mode: args.mode, reportDir, prepared: reviews.length, summary }, null, 2));
      return;
    }

    console.log(JSON.stringify({ mode: args.mode, reportDir, products: products.length, feishuGroups: groups.size, summary }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
