import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  buildAdjustedProductPricing,
  priceAdjustmentConfigFromStoredValues
} from "../lib/product-price-adjustment";
import { INTERNAL_AVAILABLE_STOCK_QUANTITY } from "../lib/product-stock";

type Mode = "dry-run" | "apply";

type SheetInfo = {
  sheetId: string;
  title: string;
};

type HeaderMap = {
  headerRowIndex: number;
  columns: {
    category: number;
    brand: number;
    name: number;
    model: number;
    unitPrice: number;
    sampleImage: number;
    boxPrice: number;
    trayImage: number;
    trayStatus: number;
    packageImage: number;
    packageQty: number;
    note: number;
  };
};

type FeishuRow = {
  rowNumber: number;
  category: string;
  brand: string;
  productName: string;
  model: string;
  mainModel: string;
  unitPriceRaw: string;
  unitPriceCents: number;
  boxPrice: string;
  trayStatus: string;
  packageQty: string;
  note: string;
  sampleToken: string;
  trayToken: string;
  packageToken: string;
};

type ProductGroup = {
  rows: FeishuRow[];
  category: string;
  brand: string;
  productName: string;
  mainModel: string;
  displayName: string;
  slug: string;
  unitPriceCents: number;
  boxPrice: string;
  classification: Classification;
  trayToken: string;
  packageToken: string;
};

type Classification = {
  categorySlug: string;
  categoryLabel: string;
  categoryNote: string;
  subcategoryLabel: string;
};

type RowImportOverride = {
  productName?: string;
  displayName?: string;
  categorySlug?: keyof typeof CATEGORY_INFO;
  subcategoryLabel?: string;
};

type DownloadedImage = {
  token: string;
  localPath: string;
  contentType: string;
};

type LocalImageEntry = {
  localPath: string;
  brandKey: string;
  code: string;
  baseCode: string;
  dashlessCode: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const DEFAULT_SPREADSHEET_TOKEN = "BoyiswTjkhtGJXtiOCVc3jGxn3c";
const DEFAULT_SHEET_TITLE = "商品录入";
const DEFAULT_READ_RANGE = "A1:L8000";
const DEFAULT_IMAGE_ROOT = "D:\\图\\2 La Bella maquiagem 💄-20260622T115331Z-3-001\\2 La Bella maquiagem 💄";
const DEFAULT_REPORT_DIR = path.join(DEFAULT_IMAGE_ROOT, "_feishu_reports", "pilot-products");
const CATEGORY_INFO: Record<string, { label: string; note: string }> = {
  rosto: {
    label: "Rosto",
    note: "Base, corretivo, pó, blush, iluminador, primer e skincare facial."
  },
  "olhos-sobrancelhas": {
    label: "Olhos e Sobrancelhas",
    note: "Sombras, delineadores, máscaras, cílios e itens para sobrancelha."
  },
  labios: {
    label: "Lábios",
    note: "Batons, gloss, balm, lápis labial e produtos para boca."
  },
  "corpo-banho": {
    label: "Corpo e Banho",
    note: "Hidratantes, sabonetes, banho e cuidados corporais."
  },
  cabelos: {
    label: "Cabelos",
    note: "Shampoo, tratamento, finalizadores, óleos e acessórios capilares."
  },
  perfumes: {
    label: "Perfumes",
    note: "Perfumes, colônias, body splash e brumas perfumadas."
  },
  unhas: {
    label: "Unhas",
    note: "Esmaltes, bases, cuidados e acessórios de manicure."
  },
  acessorios: {
    label: "Acessórios",
    note: "Pincéis, esponjas, nécessaires e ferramentas de apoio."
  }
};

const ROW_IMPORT_OVERRIDES: Record<number, RowImportOverride> = {
  191: {
    productName: "Esfoliante Corporal Body Juice Cereja Dermachem 100g",
    displayName: "Esfoliante Corporal Body Juice Cereja Dermachem 100g",
    categorySlug: "corpo-banho",
    subcategoryLabel: "Esfoliante corporal"
  },
  192: {
    productName: "Esfoliante Corporal Body Juice Maracujá Dermachem 100g",
    displayName: "Esfoliante Corporal Body Juice Maracujá Dermachem 100g",
    categorySlug: "corpo-banho",
    subcategoryLabel: "Esfoliante corporal"
  },
  193: {
    productName: "Esfoliante Corporal Body Juice Melancia Dermachem 100g",
    displayName: "Esfoliante Corporal Body Juice Melancia Dermachem 100g",
    categorySlug: "corpo-banho",
    subcategoryLabel: "Esfoliante corporal"
  },
  194: {
    productName: "Sabonete de Banho Body Juice Morango Dermachem 100ml",
    displayName: "Sabonete de Banho Body Juice Morango Dermachem 100ml",
    categorySlug: "corpo-banho",
    subcategoryLabel: "Sabonete corporal"
  },
  196: {
    productName: "Gel Esfoliante Facial Rosa Mosqueta Dermachem 100g",
    displayName: "Gel Esfoliante Facial Rosa Mosqueta Dermachem 100g",
    categorySlug: "rosto",
    subcategoryLabel: "Esfoliante facial"
  },
  198: {
    productName: "Gel Rosa Mosqueta para Pele Sensível e Extrasseca Dermachem 100g",
    displayName: "Gel Rosa Mosqueta para Pele Sensível e Extrasseca Dermachem 100g",
    categorySlug: "rosto",
    subcategoryLabel: "Gel facial"
  },
  200: {
    productName: "Gel Esfoliante Facial Vitamina C Dermachem 100g",
    displayName: "Gel Esfoliante Facial Vitamina C Dermachem 100g",
    categorySlug: "rosto",
    subcategoryLabel: "Esfoliante facial"
  },
  201: {
    productName: "Gel Esfoliante Facial Ácido Salicílico Dermachem 100g",
    displayName: "Gel Esfoliante Facial Ácido Salicílico Dermachem 100g",
    categorySlug: "rosto",
    subcategoryLabel: "Esfoliante facial"
  },
  202: {
    productName: "Sabonete Facial Demaquilante New Make Out Niacinamida Dermachem",
    displayName: "Sabonete Facial Demaquilante New Make Out Niacinamida Dermachem",
    categorySlug: "rosto",
    subcategoryLabel: "Sabonete facial"
  },
  203: {
    productName: "Sérum Facial Peônia Dermachem",
    displayName: "Sérum Facial Peônia Dermachem",
    categorySlug: "rosto",
    subcategoryLabel: "Sérum facial"
  },
  204: {
    productName: "Sérum Facial Rosa Mosqueta Dermachem 30ml",
    displayName: "Sérum Facial Rosa Mosqueta Dermachem 30ml",
    categorySlug: "rosto",
    subcategoryLabel: "Sérum facial"
  },
  205: {
    productName: "Protetor Solar Facial FPS 85 com Niacinamida Dermachem 40g",
    displayName: "Protetor Solar Facial FPS 85 com Niacinamida Dermachem 40g",
    categorySlug: "rosto",
    subcategoryLabel: "Protetor solar facial"
  },
  206: {
    productName: "Protetor Solar Facial FPS 60 sem Cor Dermachem 40g",
    displayName: "Protetor Solar Facial FPS 60 sem Cor Dermachem 40g",
    categorySlug: "rosto",
    subcategoryLabel: "Protetor solar facial"
  },
  207: {
    productName: "Sérum Facial Melasma Clear Efeito Clareador Dermachem",
    displayName: "Sérum Facial Melasma Clear Efeito Clareador Dermachem",
    categorySlug: "rosto",
    subcategoryLabel: "Sérum facial"
  },
  208: {
    productName: "Sabonete Líquido Facial Vitamina C Dermachem",
    displayName: "Sabonete Líquido Facial Vitamina C Dermachem",
    categorySlug: "rosto",
    subcategoryLabel: "Sabonete facial"
  },
  209: {
    productName: "Body Splash Body Juice Morango Dermachem 200ml",
    displayName: "Body Splash Body Juice Morango Dermachem 200ml",
    categorySlug: "perfumes",
    subcategoryLabel: "Body splash"
  },
  210: {
    productName: "Hidratante Facial Primer Anti-Craquelamento Dermachem Makeup",
    displayName: "Hidratante Facial Primer Anti-Craquelamento Dermachem Makeup",
    categorySlug: "rosto",
    subcategoryLabel: "Primer facial"
  },
  211: {
    productName: "Creme Corporal Desodorante Body Juice Cereja Dermachem 100g",
    displayName: "Creme Corporal Desodorante Body Juice Cereja Dermachem 100g",
    categorySlug: "corpo-banho",
    subcategoryLabel: "Creme corporal"
  },
  212: {
    productName: "Esfoliante Corporal Body Juice Morango Dermachem 100g",
    displayName: "Esfoliante Corporal Body Juice Morango Dermachem 100g",
    categorySlug: "corpo-banho",
    subcategoryLabel: "Esfoliante corporal"
  },
  214: {
    productName: "Ativador Facial de Limpeza Hidratante Dermachem 120ml",
    displayName: "Ativador Facial de Limpeza Hidratante Dermachem 120ml",
    categorySlug: "rosto",
    subcategoryLabel: "Limpeza facial"
  },
  215: {
    productName: "Gel Facial Vitamina C Dermachem",
    displayName: "Gel Facial Vitamina C Dermachem",
    categorySlug: "rosto",
    subcategoryLabel: "Gel facial"
  },
  216: {
    productName: "Creme Corporal Desodorante Body Juice Melancia Dermachem 100g",
    displayName: "Creme Corporal Desodorante Body Juice Melancia Dermachem 100g",
    categorySlug: "corpo-banho",
    subcategoryLabel: "Creme corporal"
  },
  218: {
    productName: "Água Micelar Vitamina C Dermachem 250ml",
    displayName: "Água Micelar Vitamina C Dermachem 250ml",
    categorySlug: "rosto",
    subcategoryLabel: "Água micelar"
  },
  219: {
    productName: "Água Micelar Rosa Mosqueta e Íons Dermachem 250ml",
    displayName: "Água Micelar Rosa Mosqueta e Íons Dermachem 250ml",
    categorySlug: "rosto",
    subcategoryLabel: "Água micelar"
  },
  220: {
    productName: "Água Micelar Ácido Salicílico Dermachem 250ml",
    displayName: "Água Micelar Ácido Salicílico Dermachem 250ml",
    categorySlug: "rosto",
    subcategoryLabel: "Água micelar"
  },
  221: {
    productName: "Sabonete Facial Primer Pré-Maquiagem com Ácido Hialurônico Dermachem",
    displayName: "Sabonete Facial Primer Pré-Maquiagem com Ácido Hialurônico Dermachem",
    categorySlug: "rosto",
    subcategoryLabel: "Sabonete facial"
  },
  222: {
    productName: "Sabonete Facial Demaquilante Make Out Dermachem",
    displayName: "Sabonete Facial Demaquilante Make Out Dermachem",
    categorySlug: "rosto",
    subcategoryLabel: "Sabonete facial"
  },
  223: {
    productName: "Máscara Facial Peel Off Pepino e Argila Verde Dermachem",
    displayName: "Máscara Facial Peel Off Pepino e Argila Verde Dermachem",
    categorySlug: "rosto",
    subcategoryLabel: "Máscara facial"
  },
  224: {
    productName: "Sabonete de Banho Body Juice Melancia Dermachem 100ml",
    displayName: "Sabonete de Banho Body Juice Melancia Dermachem 100ml",
    categorySlug: "corpo-banho",
    subcategoryLabel: "Sabonete corporal"
  },
  225: {
    productName: "Sabonete Líquido Facial Ácido Salicílico Dermachem",
    displayName: "Sabonete Líquido Facial Ácido Salicílico Dermachem",
    categorySlug: "rosto",
    subcategoryLabel: "Sabonete facial"
  },
  227: {
    productName: "Gel Esfoliante Facial com Pedras Vulcânicas Dermachem Make Out",
    displayName: "Gel Esfoliante Facial com Pedras Vulcânicas Dermachem Make Out",
    categorySlug: "rosto",
    subcategoryLabel: "Esfoliante facial"
  },
  229: {
    productName: "Máscara Facial Peel Off Argila Negra Dermachem",
    displayName: "Máscara Facial Peel Off Argila Negra Dermachem",
    categorySlug: "rosto",
    subcategoryLabel: "Máscara facial"
  },
  230: {
    productName: "Creme Corporal Desodorante Doce Limão Dermachem",
    displayName: "Creme Corporal Desodorante Doce Limão Dermachem",
    categorySlug: "corpo-banho",
    subcategoryLabel: "Creme corporal"
  },
  231: {
    productName: "Espuma Cremosa Facial Esfoliante Dermachem",
    displayName: "Espuma Cremosa Facial Esfoliante Dermachem",
    categorySlug: "rosto",
    subcategoryLabel: "Espuma de limpeza facial"
  },
  232: {
    productName: "Sabonete de Banho Body Juice Cereja Dermachem 100ml",
    displayName: "Sabonete de Banho Body Juice Cereja Dermachem 100ml",
    categorySlug: "corpo-banho",
    subcategoryLabel: "Sabonete corporal"
  },
  233: {
    productName: "Body Splash Body Juice Cereja Dermachem 200ml",
    displayName: "Body Splash Body Juice Cereja Dermachem 200ml",
    categorySlug: "perfumes",
    subcategoryLabel: "Body splash"
  },
  234: {
    productName: "Body Splash Body Juice Melancia Dermachem 200ml",
    displayName: "Body Splash Body Juice Melancia Dermachem 200ml",
    categorySlug: "perfumes",
    subcategoryLabel: "Body splash"
  },
  1613: {
    productName: "Body Splash Napolitano Bliss Poran",
    categorySlug: "perfumes",
    subcategoryLabel: "Body splash"
  },
  1729: {
    productName: "Sabonete Líquido Lovely Pitaya Rosa Mosqueta Face Beautiful",
    categorySlug: "corpo-banho",
    subcategoryLabel: "Sabonete corporal"
  },
  2237: {
    productName: "Lápis Delineador em Gel ViVai",
    categorySlug: "olhos-sobrancelhas",
    subcategoryLabel: "Delineador em lápis"
  },
  2656: {
    productName: "Shampoo a Seco Rush Isis Hair",
    categorySlug: "cabelos",
    subcategoryLabel: "Shampoo a seco"
  },
  2657: {
    productName: "Shampoo a Seco Cloud Isis Hair",
    categorySlug: "cabelos",
    subcategoryLabel: "Shampoo a seco"
  },
  2658: {
    productName: "Shampoo a Seco Blink Isis Hair",
    categorySlug: "cabelos",
    subcategoryLabel: "Shampoo a seco"
  }
};

function loadEnvFile(filePath: string, options: { override?: boolean } = {}) {
  return fs
    .readFile(filePath, "utf8")
    .then((content) => {
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
        if (options.override || !process.env[key]) process.env[key] = value;
      }
    })
    .catch(() => undefined);
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseRowFilter(value: string) {
  const rows = new Set<number>();
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const range = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start) {
        throw new Error(`Invalid --only-rows range: ${trimmed}`);
      }
      for (let row = start; row <= end; row += 1) rows.add(row);
      continue;
    }
    const row = Number(trimmed);
    if (!Number.isInteger(row) || row <= 0) throw new Error(`Invalid --only-rows value: ${trimmed}`);
    rows.add(row);
  }
  return rows;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string, fallback = "") => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] || fallback : fallback;
  };
  const mode = (get("--mode", "dry-run") as Mode) || "dry-run";
  if (mode !== "dry-run" && mode !== "apply") throw new Error("--mode must be dry-run or apply.");
  return {
    mode,
    yes: args.includes("--yes"),
    limit: Math.max(1, Number(get("--limit", "5")) || 5),
    readRange: get("--read-range", process.env.FEISHU_READ_RANGE || DEFAULT_READ_RANGE),
    sheetTitle: get("--sheet", process.env.FEISHU_SHEET_TITLE || DEFAULT_SHEET_TITLE),
    skipExisting: !args.includes("--no-skip-existing"),
    batchLabel: get("--batch-label", ""),
    onlyRows: parseRowFilter(get("--only-rows", "")),
    allowNoTrayStatus: args.includes("--allow-no-tray-status"),
    requirePackageSource: args.includes("--require-package-source")
  };
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
    throw new Error(`Feishu API failed ${method} ${pathOrUrl}: HTTP ${response.status}, code ${json.code}, msg ${json.msg}`);
  }
  return json as T;
}

async function getTenantAccessToken() {
  const response = await feishuRequest<{ tenant_access_token?: string }>(
    "POST",
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    undefined,
    {
      app_id: requireEnv("FEISHU_APP_ID"),
      app_secret: requireEnv("FEISHU_APP_SECRET")
    }
  );
  if (!response.tenant_access_token) throw new Error("Feishu did not return tenant_access_token.");
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

async function readRange(spreadsheetToken: string, sheetId: string, range: string, token: string) {
  const encodedRange = encodeURIComponent(`${sheetId}!${range}`);
  const result = await feishuRequest<{ data?: { valueRange?: { values?: unknown[][] } } }>(
    "GET",
    `/sheets/v2/spreadsheets/${spreadsheetToken}/values/${encodedRange}?valueRenderOption=FormattedValue&dateTimeRenderOption=FormattedString`,
    token
  );
  return result.data?.valueRange?.values || [];
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["text", "value", "link", "url"]) {
      if (typeof record[key] === "string" && record[key]) return String(record[key]).trim();
    }
  }
  return "";
}

function fileToken(value: unknown): string {
  if (value && typeof value === "object" && typeof (value as Record<string, unknown>).fileToken === "string") {
    return String((value as Record<string, unknown>).fileToken);
  }
  return "";
}

function findHeader(values: unknown[][]): HeaderMap {
  const aliases = {
    category: ["商品品类", "商品品類", "品类"],
    brand: ["品牌名", "品牌"],
    name: ["商品名", "产品名", "產品名"],
    model: ["型号", "型號", "SKU"],
    unitPrice: ["单价/个", "單價/個", "单价"],
    sampleImage: ["商品样图预览", "商品樣圖預覽", "样图"],
    boxPrice: ["整盒（件）/价", "整盒", "整盒价"],
    trayImage: ["货盘图", "貨盤圖"],
    trayStatus: ["货盘图状态", "貨盤圖狀態"],
    packageImage: ["完整包装图预览", "完整包裝圖預覽", "完整包装预览"],
    packageQty: ["整件/盒数量", "整件/盒數量"],
    note: ["备注", "備註"]
  };

  for (let rowIndex = 0; rowIndex < Math.min(values.length, 20); rowIndex += 1) {
    const row = values[rowIndex] || [];
    const findColumn = (names: string[]) =>
      row.findIndex((cell) => names.some((name) => cellText(cell).replace(/\s+/g, "").includes(name.replace(/\s+/g, ""))));
    const columns = {
      category: findColumn(aliases.category),
      brand: findColumn(aliases.brand),
      name: findColumn(aliases.name),
      model: findColumn(aliases.model),
      unitPrice: findColumn(aliases.unitPrice),
      sampleImage: findColumn(aliases.sampleImage),
      boxPrice: findColumn(aliases.boxPrice),
      trayImage: findColumn(aliases.trayImage),
      trayStatus: findColumn(aliases.trayStatus),
      packageImage: findColumn(aliases.packageImage),
      packageQty: findColumn(aliases.packageQty),
      note: findColumn(aliases.note)
    };
    const required = [
      columns.category,
      columns.brand,
      columns.name,
      columns.model,
      columns.unitPrice,
      columns.sampleImage,
      columns.boxPrice,
      columns.trayImage,
      columns.trayStatus
    ];
    if (required.every((index) => index >= 0)) {
      return {
        headerRowIndex: rowIndex,
        columns: {
          ...columns,
          packageImage: columns.packageImage >= 0 ? columns.packageImage : -1,
          packageQty: columns.packageQty >= 0 ? columns.packageQty : -1,
          note: columns.note >= 0 ? columns.note : -1
        }
      };
    }
  }
  throw new Error("Could not locate expected Feishu headers.");
}

function normalizeCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[–—_]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9.-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
}

function mainModel(value: string) {
  const code = normalizeCode(value);
  const parts = code.split("-").filter(Boolean);
  const colorSuffixes = new Set(["PRETO", "BRANCO", "ROSA", "NUDE", "MARROM", "VERMELHO", "LILAS", "AZUL", "VERDE"]);
  const hasVariantSuffix = (suffix: string) =>
    /^\d{1,3}$/.test(suffix) || /^[A-Z]{1,4}\d{1,3}$/.test(suffix) || colorSuffixes.has(suffix);
  if (parts.length >= 3) {
    const suffix = parts.at(-1) || "";
    if (hasVariantSuffix(suffix)) {
      return parts.slice(0, -1).join("-");
    }
  }
  if (parts.length === 2 && /\d/.test(parts[0]) && hasVariantSuffix(parts[1])) {
    return parts[0];
  }
  return code;
}

function parseMoneyCents(value: string): number {
  const match = value.replace(/\s+/g, "").match(/(\d{1,5})(?:[,.](\d{1,2}))?/);
  if (!match) return 0;
  const whole = Number(match[1]);
  const cents = Number((match[2] || "00").padEnd(2, "0").slice(0, 2));
  return whole * 100 + cents;
}

function moneyPt(cents: number) {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

function normalizeBoxText(value: string) {
  const text = value.trim();
  if (!text) return "";
  return text
    .replace(/&/g, "/")
    .replace(/pcs/gi, "pçs")
    .replace(/p[cç]s/gi, "pçs")
    .replace(/(\d+)\.(\d{2})(?=c\/)/i, "$1,$2")
    .replace(/\s+/g, "");
}

function normalizeProductNameForImport(value: string) {
  const text = value.trim();
  if (text === "防晒霜" || text === "防曬霜") return "Protetor Solar";
  return text;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function subcategorySlug(value: string) {
  return slugify(value).slice(0, 80) || "subcategoria";
}

function brandSlug(value: string) {
  return slugify(value).slice(0, 70) || "marca";
}

function brandAliasKey(value: string) {
  return slugify(value).replace(/-/g, " ");
}

const BRAND_ALIASES = new Map<string, string>([
  ["bobbi bara", "Bobbi Rara"],
  ["bobbi rara", "Bobbi Rara"],
  ["derma chem", "DERMA CHEM"],
  ["dermachem", "DERMA CHEM"],
  ["ruby rose", "Ruby Rose"],
  ["rubyrose", "Ruby Rose"],
  ["amor anjo", "Amor Anjo"],
  ["fenzza", "FENZZA"],
  ["febella", "Febella"],
  ["hudamoji", "Hudamoji"],
  ["melu", "melu"]
]);

function canonicalBrandName(value: string) {
  return BRAND_ALIASES.get(brandAliasKey(value)) || value.trim();
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function categoryInfo(slug: string) {
  return CATEGORY_INFO[slug] || CATEGORY_INFO.rosto;
}

function classify(row: Pick<FeishuRow, "category" | "productName" | "model">): Classification | null {
  const text = normalizeSearch(`${row.category} ${row.productName} ${row.model}`);
  const productText = normalizeSearch(`${row.productName} ${row.model}`);
  let categorySlug = "rosto";
  let subcategoryLabel = "Multifuncional rosto, olhos e lábios";

  if (hasAny(text, ["protetor solar", "solar", "sunscreen", "防晒", "防曬"])) {
    categorySlug = "rosto";
    subcategoryLabel = "Protetor solar facial";
  } else if (hasAny(productText, ["iluminador", "highlighter"])) {
    categorySlug = "rosto";
    subcategoryLabel = hasAny(productText, ["stick", "bastao", "bastão"]) ? "Iluminador em bastão" : "Iluminador em pó";
  } else if (hasAny(text, ["labial", "batom", "boca", "lip", "lips", "gloss", "唇"])) {
    categorySlug = "labios";
    if (hasAny(text, ["oleo", "oil", "润唇油", "唇油"])) subcategoryLabel = "Óleo labial";
    else if (hasAny(text, ["lapis", "contorno", "唇线"])) subcategoryLabel = "Lápis labial";
    else if (hasAny(text, ["gloss", "唇蜜"])) subcategoryLabel = "Gloss labial";
    else if (hasAny(text, ["liquido", "liquid", "唇釉"])) subcategoryLabel = "Batom líquido";
    else subcategoryLabel = "Batom";
  } else if (hasAny(text, ["delineador", "caneta delineadora", "眼线"])) {
    categorySlug = "olhos-sobrancelhas";
    subcategoryLabel = "Delineador em lápis";
  } else if (hasAny(text, ["sobrancelha", "眉"])) {
    categorySlug = "olhos-sobrancelhas";
    subcategoryLabel = hasAny(text, ["gel", "mascara", "fixador"]) ? "Gel para sobrancelhas" : "Lápis para sobrancelhas";
  } else if (hasAny(text, ["cilios", "cílios", "mascara", "睫毛"])) {
    categorySlug = "olhos-sobrancelhas";
    subcategoryLabel = "Máscara de cílios";
  } else if (hasAny(text, ["sombra", "eyeshadow", "眼影"])) {
    categorySlug = "olhos-sobrancelhas";
    subcategoryLabel = hasAny(text, ["paleta"]) ? "Paleta de sombras" : "Sombra unitária";
  } else if (hasAny(text, ["iluminador", "highlighter", "高光"])) {
    categorySlug = "rosto";
    subcategoryLabel = hasAny(text, ["stick", "bastao", "bastão"]) ? "Iluminador em bastão" : "Iluminador em pó";
  } else if (hasAny(text, ["blush", "腮红"])) {
    categorySlug = "rosto";
    subcategoryLabel = "Blush";
  } else if (hasAny(text, ["contorno", "修容"])) {
    categorySlug = "rosto";
    subcategoryLabel = hasAny(text, ["cremoso", "cream", "膏"]) ? "Contorno cremoso" : "Pó de contorno";
  } else if (hasAny(text, ["base em po", "base em pó", "powder foundation", "粉状粉底", "定妆粉饼"])) {
    categorySlug = "rosto";
    subcategoryLabel = "Base em pó";
  } else if (hasAny(text, ["base", "粉底"])) {
    categorySlug = "rosto";
    subcategoryLabel = "Base líquida";
  } else if (hasAny(text, ["corretivo", "遮瑕"])) {
    categorySlug = "rosto";
    subcategoryLabel = "Corretivo";
  } else if (hasAny(text, ["po compacto", "pó compacto", "粉饼"])) {
    categorySlug = "rosto";
    subcategoryLabel = "Pó compacto";
  } else if (hasAny(text, ["primer", "妆前"])) {
    categorySlug = "rosto";
    subcategoryLabel = "Primer facial";
  } else if (hasAny(text, ["demaquilante", "removedor", "卸妆"])) {
    categorySlug = "rosto";
    if (hasAny(text, ["oleo", "oil", "油"])) subcategoryLabel = "Óleo demaquilante";
    else if (hasAny(text, ["agua micelar", "micelar", "水"])) subcategoryLabel = "Água micelar";
    else subcategoryLabel = "Lenços demaquilantes";
  } else if (hasAny(text, ["limpeza facial", "洗面", "cleanser"])) {
    categorySlug = "rosto";
    subcategoryLabel = hasAny(text, ["espuma", "foam"]) ? "Espuma de limpeza facial" : "Gel de limpeza facial";
  } else if (hasAny(text, ["body splash", "perfume", "colonia", "colônia", "香"])) {
    categorySlug = "perfumes";
    subcategoryLabel = hasAny(text, ["body splash"]) ? "Body splash" : "Perfume";
  } else if (hasAny(text, ["corpo", "body", "banho", "hidratante", "身体", "沐浴"])) {
    categorySlug = "corpo-banho";
    if (hasAny(text, ["oleo", "oil", "油"])) subcategoryLabel = "Óleo corporal";
    else if (hasAny(text, ["desodorante", "除臭"])) subcategoryLabel = "Desodorante corporal";
    else if (hasAny(text, ["sabonete", "沐浴"])) subcategoryLabel = "Sabonete líquido corporal";
    else subcategoryLabel = "Creme hidratante corporal";
  } else if (hasAny(text, ["puff", "esponja", "pincel", "algodao", "algodão", "lenço", "len莽o", "粉扑", "清洁棉"])) {
    categorySlug = "acessorios";
    if (hasAny(text, ["puff", "粉扑"])) subcategoryLabel = "Puff de maquiagem";
    else if (hasAny(text, ["esponja"])) subcategoryLabel = "Esponja de maquiagem";
    else if (hasAny(text, ["algodao", "algodão"])) subcategoryLabel = "Discos de algodão";
    else if (hasAny(text, ["lenço", "len莽o", "lenços"])) subcategoryLabel = "Lenços demaquilantes";
    else subcategoryLabel = "Pincel de maquiagem";
  }

  const info = categoryInfo(categorySlug);
  if (!info) return null;
  return { categorySlug, categoryLabel: info.label, categoryNote: info.note, subcategoryLabel };
}

function formatDisplayName(productName: string, model: string) {
  const normalizedName = normalizeSearch(productName);
  const normalizedModel = normalizeSearch(model);
  return normalizedName.includes(normalizedModel) ? productName.trim() : `${productName.trim()} ${model}`.trim();
}

function classificationForRow(row: FeishuRow) {
  const override = ROW_IMPORT_OVERRIDES[row.rowNumber];
  if (!override?.categorySlug || !override.subcategoryLabel) return classify(row);
  const info = categoryInfo(override.categorySlug);
  if (!info) return null;
  return {
    categorySlug: override.categorySlug,
    categoryLabel: info.label,
    categoryNote: info.note,
    subcategoryLabel: override.subcategoryLabel
  };
}

function parseRows(values: unknown[][], headers: HeaderMap): FeishuRow[] {
  const rows: FeishuRow[] = [];
  let lastCategory = "";
  let lastBrand = "";
  let lastName = "";
  let lastNameBase = "";
  let lastUnit = "";
  let lastUnitBase = "";
  let lastBox = "";
  let lastBoxBase = "";
  let lastStatus = "";
  let lastStatusBase = "";
  let lastTrayToken = "";
  let lastTrayBase = "";
  let lastPackageQty = "";

  for (let index = headers.headerRowIndex + 1; index < values.length; index += 1) {
    const row = values[index] || [];
    const rowNumber = index + 1;
    const rawModel = cellText(row[headers.columns.model]);
    const model = normalizeCode(rawModel);
    if (!model) continue;
    const base = mainModel(model);

    const rawCategory = cellText(row[headers.columns.category]);
    const rawBrand = cellText(row[headers.columns.brand]);
    const rowOverride = ROW_IMPORT_OVERRIDES[rowNumber];
    const rawName = rowOverride?.productName || normalizeProductNameForImport(cellText(row[headers.columns.name]));
    const rawUnit = cellText(row[headers.columns.unitPrice]);
    const rawBox = cellText(row[headers.columns.boxPrice]);
    const rawStatus = cellText(row[headers.columns.trayStatus]);
    const rawPackageQty = headers.columns.packageQty >= 0 ? cellText(row[headers.columns.packageQty]) : "";
    const rawNote = headers.columns.note >= 0 ? cellText(row[headers.columns.note]) : "";
    const sampleToken = fileToken(row[headers.columns.sampleImage]);
    const directTrayToken = fileToken(row[headers.columns.trayImage]);
    const packageToken = headers.columns.packageImage >= 0 ? fileToken(row[headers.columns.packageImage]) : "";

    if (rawCategory) lastCategory = rawCategory;
    if (rawBrand) lastBrand = canonicalBrandName(rawBrand);
    if (rawName) {
      lastName = rawName;
      lastNameBase = base;
    }
    if (rawUnit) {
      lastUnit = rawUnit;
      lastUnitBase = base;
    }
    if (rawBox) {
      lastBox = rawBox;
      lastBoxBase = base;
    }
    if (rawStatus) {
      lastStatus = rawStatus;
      lastStatusBase = base;
    }
    if (directTrayToken) {
      lastTrayToken = directTrayToken;
      lastTrayBase = base;
    }
    if (rawPackageQty) lastPackageQty = rawPackageQty;

    const productName = rawName || (lastNameBase === base ? lastName : "");
    const unitPriceRaw = rawUnit || (lastUnitBase === base ? lastUnit : "");
    const boxPrice = rawBox || (lastBoxBase === base ? lastBox : "");
    const trayStatus = rawStatus || (lastStatusBase === base ? lastStatus : "");
    const trayToken = directTrayToken || (lastTrayBase === base ? lastTrayToken : "");
    const unitPriceCents = parseMoneyCents(unitPriceRaw);

    rows.push({
      rowNumber,
      category: rawCategory || lastCategory,
      brand: rawBrand ? canonicalBrandName(rawBrand) : lastBrand,
      productName,
      model,
      mainModel: base,
      unitPriceRaw,
      unitPriceCents,
      boxPrice,
      trayStatus,
      packageQty: rawPackageQty || lastPackageQty,
      note: rawNote,
      sampleToken,
      trayToken,
      packageToken
    });
  }
  return rows;
}

function shouldUseRow(row: FeishuRow, allowNoTrayRows: Set<number>, requirePackageSource: boolean) {
  const hasRequiredFields = Boolean(
    row.category &&
      row.brand &&
      row.productName &&
      row.model &&
      row.sampleToken &&
      row.unitPriceCents > 0
  );
  return (
    hasRequiredFields &&
    (!requirePackageSource || Boolean(row.packageToken || row.trayToken)) &&
    (row.trayStatus.includes("已有货盘图") || allowNoTrayRows.has(row.rowNumber))
  );
}

function selectGroups(
  rows: FeishuRow[],
  limit: number,
  allowNoTrayRows = new Set<number>(),
  requirePackageSource = false
) {
  const selected: ProductGroup[] = [];
  const skipped: Array<{ row: number; brand: string; model: string; reason: string }> = [];
  let active: FeishuRow[] = [];
  let activeKey = "";

  function flush() {
    if (!active.length) return;
    const first = active[0];
    const classification = classificationForRow(first);
    if (!classification) {
      skipped.push({ row: first.rowNumber, brand: first.brand, model: first.mainModel, reason: "classification unavailable" });
      active = [];
      activeKey = "";
      return;
    }
    const boxValues = Array.from(new Set(active.map((row) => normalizeBoxText(row.boxPrice)).filter(Boolean)));
    if (boxValues.length > 1) {
      skipped.push({ row: first.rowNumber, brand: first.brand, model: first.mainModel, reason: "box price conflict in group" });
      active = [];
      activeKey = "";
      return;
    }
    const displayName = ROW_IMPORT_OVERRIDES[first.rowNumber]?.displayName || formatDisplayName(first.productName, first.mainModel);
    selected.push({
      rows: active,
      category: first.category,
      brand: first.brand,
      productName: first.productName,
      mainModel: first.mainModel,
      displayName,
      slug: slugify(displayName),
      unitPriceCents: first.unitPriceCents,
      boxPrice: boxValues[0] || "",
      classification,
      trayToken: first.trayToken,
      packageToken: active.find((row) => row.packageToken)?.packageToken || ""
    });
    active = [];
    activeKey = "";
  }

  for (const row of rows) {
    if (selected.length >= limit) break;
    if (!shouldUseRow(row, allowNoTrayRows, requirePackageSource)) {
      if (row.trayStatus.includes("已有货盘图") || allowNoTrayRows.has(row.rowNumber)) {
        const reason =
          requirePackageSource && !row.packageToken && !row.trayToken
            ? "missing_package_image_source"
            : row.productName
              ? "missing price or sample image"
              : "missing_product_name";
        skipped.push({
          row: row.rowNumber,
          brand: row.brand,
          model: row.model,
          reason
        });
      }
      flush();
      continue;
    }
    const key = [row.brand, row.productName, row.mainModel, row.unitPriceCents].map((item) => String(item).toLowerCase()).join("|");
    if (active.length && key !== activeKey) flush();
    if (!active.length) activeKey = key;
    active.push(row);
  }
  flush();

  return { selected: selected.slice(0, limit), skipped };
}

function groupImageIssue(group: ProductGroup, images: Map<string, DownloadedImage>) {
  const missingSamples = group.rows.filter((row) => !row.sampleToken || !images.has(row.sampleToken));
  if (missingSamples.length) return `sample image unavailable for row(s) ${missingSamples.map((row) => row.rowNumber).join("|")}`;
  return "";
}

function safeFilePart(value: string) {
  return slugify(value).replace(/-/g, "_").slice(0, 70) || "image";
}

function normalizeBrandKey(value: string) {
  return slugify(value).replace(/-/g, "");
}

function dashlessCode(value: string) {
  return normalizeCode(value).replace(/-/g, "");
}

function isImageFile(filePath: string) {
  return [".jpg", ".jpeg", ".png", ".webp", ".bmp"].includes(path.extname(filePath).toLowerCase());
}

async function walkLocalImages(root: string) {
  const images: LocalImageEntry[] = [];
  async function walk(current: string, brandFolder = "") {
    const items = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const item of items) {
      if (item.name.startsWith(".") || item.name.startsWith("_")) continue;
      const fullPath = path.join(current, item.name);
      if (item.isDirectory()) {
        await walk(fullPath, brandFolder || item.name);
        continue;
      }
      if (!item.isFile() || !isImageFile(fullPath)) continue;
      const code = normalizeCode(path.basename(item.name, path.extname(item.name)));
      if (!code) continue;
      images.push({
        localPath: fullPath,
        brandKey: normalizeBrandKey(brandFolder),
        code,
        baseCode: mainModel(code),
        dashlessCode: dashlessCode(code)
      });
    }
  }
  await walk(root);
  return images;
}

function findLocalTrayImage(group: ProductGroup, images: LocalImageEntry[]) {
  const brandKey = normalizeBrandKey(group.brand);
  const code = normalizeCode(group.mainModel);
  const dashless = dashlessCode(code);
  const pool = images.filter((image) => image.brandKey === brandKey);
  const candidates = pool.length ? pool : images;
  return (
    candidates.find((image) => image.code === code) ||
    candidates.find((image) => image.baseCode === code) ||
    candidates.find((image) => image.dashlessCode === dashless) ||
    null
  );
}

async function readableFile(filePath: string) {
  return fs.stat(filePath).then((stat) => stat.isFile() && stat.size > 0).catch(() => false);
}

async function cachedSheetImagePath(reportDir: string, row: FeishuRow, token: string) {
  const reportRoot = path.dirname(reportDir);
  const directPaths = [
    path.join(reportDir, "image-cache", `${safeFilePart(token)}.jpg`),
    path.join(sharedImageCacheDir(reportDir), `${safeFilePart(token)}.jpg`),
    path.join(reportRoot, "sample-cache", `row-${row.rowNumber}-${token}.jpg`)
  ];
  for (const item of directPaths) {
    if (await readableFile(item)) return item;
  }

  const sampleCacheDir = path.join(reportRoot, "sample-cache");
  const items = await fs.readdir(sampleCacheDir).catch(() => []);
  const match = items.find((item) => item.includes(token) && item.startsWith(`row-${row.rowNumber}-`));
  if (match) {
    const fullPath = path.join(sampleCacheDir, match);
    if (await readableFile(fullPath)) return fullPath;
  }
  return "";
}

async function tmpDownloadUrls(tokens: string[], tenantToken: string) {
  const urls = new Map<string, string>();
  const unique = Array.from(new Set(tokens.filter(Boolean)));
  for (let index = 0; index < unique.length; index += 50) {
    const chunk = unique.slice(index, index + 50);
    const query = new URLSearchParams({ file_tokens: chunk.join(",") }).toString();
    const result = await feishuRequest<{ data?: { tmp_download_urls?: Array<Record<string, unknown>> } }>(
      "GET",
      `/drive/v1/medias/batch_get_tmp_download_url?${query}`,
      tenantToken
    );
    for (const item of result.data?.tmp_download_urls || []) {
      const token = String(item.file_token || "");
      const url = String(item.tmp_download_url || "");
      if (token && url) urls.set(token, url);
    }
  }
  return urls;
}

async function mapWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item === undefined) return;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function downloadFeishuMedia(token: string, tenantToken: string) {
  const response = await fetch(`https://open.feishu.cn/open-apis/drive/v1/medias/${encodeURIComponent(token)}/download`, {
    headers: {
      Authorization: `Bearer ${tenantToken}`,
      "User-Agent": "Mozilla/5.0"
    }
  });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

function sharedImageCacheDir(reportDir: string) {
  return path.join(path.dirname(reportDir), "shared-image-cache");
}

async function downloadImages(groups: ProductGroup[], tenantToken: string, reportDir: string) {
  const imageRoot = process.env.FEISHU_LOCAL_IMAGE_ROOT || DEFAULT_IMAGE_ROOT;
  const localImages = await walkLocalImages(imageRoot);
  const tokens = Array.from(
    new Set(groups.flatMap((group) => [...group.rows.map((row) => row.sampleToken), group.trayToken, group.packageToken].filter(Boolean)))
  );
  const cacheDir = sharedImageCacheDir(reportDir);
  await fs.mkdir(cacheDir, { recursive: true });
  const downloaded = new Map<string, DownloadedImage>();

  for (const group of groups) {
    const tray = findLocalTrayImage(group, localImages);
    if (group.trayToken && tray) {
      downloaded.set(group.trayToken, {
        token: group.trayToken,
        localPath: tray.localPath,
        contentType: "image/jpeg"
      });
    }
    for (const row of group.rows) {
      if (!row.sampleToken || downloaded.has(row.sampleToken)) continue;
      const cachedPath = await cachedSheetImagePath(reportDir, row, row.sampleToken);
      if (cachedPath) {
        downloaded.set(row.sampleToken, {
          token: row.sampleToken,
          localPath: cachedPath,
          contentType: "image/jpeg"
        });
      }
    }
  }

  const pendingTokens = tokens.filter((token) => !downloaded.has(token));
  const urls = await tmpDownloadUrls(pendingTokens, tenantToken);
  await mapWithConcurrency(pendingTokens, Number(process.env.FEISHU_IMAGE_DOWNLOAD_CONCURRENCY || "8") || 8, async (token) => {
    if (downloaded.has(token)) return;
    const cachePath = path.join(cacheDir, `${safeFilePart(token)}.jpg`);
    try {
      const existing = await fs.stat(cachePath).then((stat) => stat.size > 0).catch(() => false);
      if (!existing) {
        const url = urls.get(token);
        let buffer: Buffer | null = null;
        if (url) {
          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${tenantToken}`,
              "User-Agent": "Mozilla/5.0"
            }
          });
          if (response.ok) buffer = Buffer.from(await response.arrayBuffer());
        }
        buffer ||= await downloadFeishuMedia(token, tenantToken);
        if (!buffer) return;
        await fs.writeFile(cachePath, buffer);
      }
      downloaded.set(token, {
        token,
        localPath: cachePath,
        contentType: "image/jpeg"
      });
    } catch {
      // Keep the failure in the report instead of throwing away the full batch.
    }
  });
  return downloaded;
}

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function writeCsv(filePath: string, rows: unknown[][]) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, rows.map((row) => row.map(csvValue).join(",")).join("\n"), "utf8");
}

function timestampLabel() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function createPrismaClient() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: requireEnv("DATABASE_URL") }) });
}

async function findExistingProductConflicts(groups: ProductGroup[]) {
  if (!groups.length) return new Map<string, string>();
  const prisma = createPrismaClient();
  try {
    const products = await prisma.product.findMany({
      select: {
        slug: true,
        brand: { select: { name: true } },
        skus: { select: { code: true } }
      }
    });
    const existingSlugs = new Set(products.map((product) => product.slug));
    const existingBrandModels = new Set(
      products.flatMap((product) =>
        product.skus.map((sku) => `${brandAliasKey(product.brand.name)}|${mainModel(sku.code)}`)
      )
    );
    const conflicts = new Map<string, string>();

    for (const group of groups) {
      if (existingSlugs.has(group.slug)) {
        conflicts.set(group.slug, "already_imported_slug");
        continue;
      }
      const brandKey = brandAliasKey(group.brand);
      const matchingModel = group.rows
        .map((row) => mainModel(row.model))
        .find((model) => existingBrandModels.has(`${brandKey}|${model}`));
      if (matchingModel) conflicts.set(group.slug, `already_imported_brand_model:${matchingModel}`);
    }

    return conflicts;
  } finally {
    await prisma.$disconnect();
  }
}

function descriptionFor(group: ProductGroup) {
  const unit = moneyPt(group.unitPriceCents);
  const box = group.boxPrice ? normalizeBoxText(group.boxPrice) : "";
  if (box) return `Preço unitário: ${unit}; Embalagem para atacado: ${box}.`;
  return `Preço unitário: ${unit}; Embalagem para atacado: consulte pelo WhatsApp.`;
}

async function uploadToBlob(localPath: string, blobPath: string, contentType: string) {
  const { put } = await import("@vercel/blob");
  const buffer = await fs.readFile(localPath);
  const result = await put(blobPath, buffer, {
    access: "public",
    addRandomSuffix: false,
    contentType,
    allowOverwrite: true
  } as Parameters<typeof put>[2] & { allowOverwrite: boolean });
  return result.url;
}

async function ensureCatalogRecords(
  prisma: PrismaClient,
  group: ProductGroup
): Promise<{ brandId: string; categoryId: string; subcategoryId: string; subcategoryLabel: string }> {
  const brandName = canonicalBrandName(group.brand);
  const slug = brandSlug(brandName);
  const existingBrand = await prisma.brand.findFirst({
    where: {
      OR: [{ name: brandName }, { slug }]
    },
    select: { id: true, categorySlugs: true }
  });
  const brandCategorySlugs = Array.from(
    new Set([...(existingBrand?.categorySlugs || []), group.classification.categorySlug])
  );

  const brand = existingBrand
    ? await prisma.brand.update({
        where: { id: existingBrand.id },
        data: {
          categorySlugs: brandCategorySlugs
        }
      })
    : await prisma.brand.create({
        data: {
          name: brandName,
          slug,
          logo: brandName
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 3)
            .toUpperCase(),
          origin: "",
          descriptionPt: `${brandName} no atacado RosaGiro.`,
          featured: false,
          categorySlugs: brandCategorySlugs
        }
      });

  const category = await prisma.category.upsert({
    where: { slug: group.classification.categorySlug },
    update: {
      label: group.classification.categoryLabel,
      note: group.classification.categoryNote
    },
    create: {
      slug: group.classification.categorySlug,
      label: group.classification.categoryLabel,
      note: group.classification.categoryNote
    }
  });

  const subcategory = await prisma.productSubcategory.upsert({
    where: {
      categoryId_slug: {
        categoryId: category.id,
        slug: subcategorySlug(group.classification.subcategoryLabel)
      }
    },
    update: { label: group.classification.subcategoryLabel },
    create: {
      categoryId: category.id,
      slug: subcategorySlug(group.classification.subcategoryLabel),
      label: group.classification.subcategoryLabel,
      sortOrder: 1000
    }
  });

  return { brandId: brand.id, categoryId: category.id, subcategoryId: subcategory.id, subcategoryLabel: subcategory.label };
}

async function applyGroups(groups: ProductGroup[], images: Map<string, DownloadedImage>, reportDir: string) {
  requireEnv("BLOB_READ_WRITE_TOKEN");
  const prisma = createPrismaClient();
  const priceProfile = await prisma.storeProfile.findUnique({
    where: { id: "main" },
    select: {
      priceAdjustmentDirection: true,
      priceAdjustmentType: true,
      priceAdjustmentValue: true
    }
  });
  const priceAdjustment = priceAdjustmentConfigFromStoredValues(
    priceProfile?.priceAdjustmentDirection,
    priceProfile?.priceAdjustmentType,
    priceProfile?.priceAdjustmentValue
  );
  const applied: unknown[][] = [
    ["slug", "rows", "brand", "name", "mainModel", "skuCount", "category", "subcategory", "image", "galleryCount", "trayImage"]
  ];
  const skipped: unknown[][] = [["rows", "brand", "mainModel", "reason"]];

  try {
    for (const group of groups) {
      const missingImageRows = group.rows.filter((row) => !images.has(row.sampleToken));
      const tray = group.trayToken ? images.get(group.trayToken) : undefined;
      if (missingImageRows.length) {
        skipped.push([
          group.rows.map((row) => row.rowNumber).join("|"),
          group.brand,
          group.mainModel,
          "sample image download failed"
        ]);
        continue;
      }

      const uploadedSkuImages: string[] = [];
      const skuData: Array<{ name: string; code: string; image: string; sortOrder: number }> = [];
      const seenSkuCodes = new Set<string>();
      for (let index = 0; index < group.rows.length; index += 1) {
        const row = group.rows[index];
        const image = images.get(row.sampleToken);
        if (!image) continue;
        const url = await uploadToBlob(
          image.localPath,
          `products/${group.slug}/sku-${String(index + 1).padStart(2, "0")}-${safeFilePart(row.model)}.jpg`,
          image.contentType
        );
        uploadedSkuImages.push(url);
        if (seenSkuCodes.has(row.model)) continue;
        seenSkuCodes.add(row.model);
        skuData.push({ name: row.model, code: row.model, image: url, sortOrder: (index + 1) * 10 });
      }

      const trayUrl = tray
        ? await uploadToBlob(tray.localPath, `products/${group.slug}/tray-${safeFilePart(group.mainModel)}.jpg`, tray.contentType)
        : "";
      const packageImage = group.packageToken ? images.get(group.packageToken) : undefined;
      const packageUrl = packageImage
        ? await uploadToBlob(packageImage.localPath, `products/${group.slug}/package-${safeFilePart(group.mainModel)}.jpg`, packageImage.contentType)
        : "";

      const primaryImage = uploadedSkuImages[0];
      const gallery = Array.from(new Set([...uploadedSkuImages.slice(1), packageUrl].filter(Boolean))).slice(0, 8);
      const catalog = await ensureCatalogRecords(prisma, group);
      const descriptionPt = descriptionFor(group);
      const adjustedPricing = buildAdjustedProductPricing({
        basePriceCents: group.unitPriceCents,
        descriptionPt,
        config: priceAdjustment
      });
      if (!adjustedPricing.ok) {
        skipped.push([group.rows.map((row) => row.rowNumber).join("|"), group.brand, group.mainModel, adjustedPricing.reason]);
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const product = await tx.product.upsert({
          where: { slug: group.slug },
          update: {
            brandId: catalog.brandId,
            categoryId: catalog.categoryId,
            subcategoryId: catalog.subcategoryId,
            subcategory: catalog.subcategoryLabel,
            name: group.displayName,
            priceCents: adjustedPricing.priceCents,
            basePriceCents: group.unitPriceCents,
            baseBoxPriceCents: adjustedPricing.baseBoxPriceCents,
            baseBoxPieces: adjustedPricing.baseBoxPieces,
            compareAtPriceCents: null,
            weightGrams: null,
            image: primaryImage,
            trayImage: trayUrl || undefined,
            gallery,
            descriptionPt: adjustedPricing.descriptionPt,
            benefits: [],
            ingredients: [],
            skinType: "",
            finish: "",
            volume: "",
            rating: 0,
            reviewCount: 0,
            stockStatus: "Em estoque",
            badges: ["Atacado", catalog.subcategoryLabel],
            active: true,
            deletedAt: null,
            deletedByAdminEmail: null,
            deleteNote: null,
            wholesalePackage: adjustedPricing.wholesalePackage,
            validityNote: "Validade/lote sob conferência no atendimento antes do envio.",
            purchaseNote: "Venda somente em embalagem fechada do fabricante, sem fracionamento ou escolha de cores. Confirme o estoque antes do envio."
          },
          create: {
            slug: group.slug,
            brandId: catalog.brandId,
            categoryId: catalog.categoryId,
            subcategoryId: catalog.subcategoryId,
            subcategory: catalog.subcategoryLabel,
            name: group.displayName,
            priceCents: adjustedPricing.priceCents,
            basePriceCents: group.unitPriceCents,
            baseBoxPriceCents: adjustedPricing.baseBoxPriceCents,
            baseBoxPieces: adjustedPricing.baseBoxPieces,
            compareAtPriceCents: null,
            weightGrams: null,
            image: primaryImage,
            trayImage: trayUrl || null,
            gallery,
            descriptionPt: adjustedPricing.descriptionPt,
            benefits: [],
            ingredients: [],
            skinType: "",
            finish: "",
            volume: "",
            rating: 0,
            reviewCount: 0,
            stockStatus: "Em estoque",
            badges: ["Atacado", catalog.subcategoryLabel],
            active: true,
            featuredRank: 0,
            wholesalePackage: adjustedPricing.wholesalePackage,
            validityNote: "Validade/lote sob conferência no atendimento antes do envio.",
            purchaseNote: "Venda somente em embalagem fechada do fabricante, sem fracionamento ou escolha de cores. Confirme o estoque antes do envio.",
            inventory: { create: { quantity: INTERNAL_AVAILABLE_STOCK_QUANTITY } }
          },
          select: { id: true }
        });

        await tx.inventory.upsert({
          where: { productId: product.id },
          update: { quantity: INTERNAL_AVAILABLE_STOCK_QUANTITY * skuData.length },
          create: { productId: product.id, quantity: INTERNAL_AVAILABLE_STOCK_QUANTITY * skuData.length }
        });

        for (const sku of skuData) {
          await tx.productSku.upsert({
            where: { productId_code: { productId: product.id, code: sku.code } },
            update: {
              name: sku.name,
              image: sku.image,
              priceCents: adjustedPricing.priceCents,
              basePriceCents: group.unitPriceCents,
              quantity: INTERNAL_AVAILABLE_STOCK_QUANTITY,
              active: true,
              sortOrder: sku.sortOrder
            },
            create: {
              productId: product.id,
              name: sku.name,
              code: sku.code,
              image: sku.image,
              priceCents: adjustedPricing.priceCents,
              basePriceCents: group.unitPriceCents,
              quantity: INTERNAL_AVAILABLE_STOCK_QUANTITY,
              active: true,
              sortOrder: sku.sortOrder
            }
          });
        }

        await tx.productSku.updateMany({
          where: { productId: product.id, code: { notIn: skuData.map((sku) => sku.code) } },
          data: { active: false }
        });
      });

      applied.push([
        group.slug,
        group.rows.map((row) => row.rowNumber).join("|"),
        group.brand,
        group.displayName,
        group.mainModel,
        skuData.length,
        group.classification.categoryLabel,
        catalog.subcategoryLabel,
        primaryImage,
        gallery.length,
        trayUrl || "missing internal tray image"
      ]);
    }
  } finally {
    await prisma.$disconnect();
  }

  await writeCsv(path.join(reportDir, "pilot-products-applied.csv"), applied);
  await writeCsv(path.join(reportDir, "pilot-products-skipped-apply.csv"), skipped);
}

async function main() {
  await loadEnvFile(path.join(repoRoot, ".env.local"));
  await loadEnvFile(path.join(repoRoot, ".env.feishu.local"));
  await loadEnvFile(path.join(repoRoot, ".env.vercel.production.local"), { override: true });
  const args = parseArgs();
  if (args.mode === "apply" && !args.yes) throw new Error("Refusing to apply without --yes.");

  const spreadsheetToken = process.env.FEISHU_SPREADSHEET_TOKEN || DEFAULT_SPREADSHEET_TOKEN;
  const baseReportDir = process.env.FEISHU_REPORT_DIR || DEFAULT_REPORT_DIR;
  const reportDir = path.join(baseReportDir, args.batchLabel || `remaining-${timestampLabel()}`);
  await fs.mkdir(reportDir, { recursive: true });

  const tenantToken = await getTenantAccessToken();
  const sheets = await querySheets(spreadsheetToken, tenantToken);
  const sheet = sheets.find((item) => item.title === args.sheetTitle) || sheets[0];
  if (!sheet) throw new Error("No sheet found in spreadsheet.");
  const values = await readRange(spreadsheetToken, sheet.sheetId, args.readRange, tenantToken);
  const headers = findHeader(values);
  const rows = parseRows(values, headers);
  const candidateResult = selectGroups(
    rows,
    rows.length,
    args.allowNoTrayStatus ? args.onlyRows : new Set<number>(),
    args.requirePackageSource
  );
  const candidateGroups = args.onlyRows.size
    ? candidateResult.selected.filter((group) => group.rows.some((row) => args.onlyRows.has(row.rowNumber)))
    : candidateResult.selected;
  const candidateSkipped = args.onlyRows.size
    ? candidateResult.skipped.filter((item) => args.onlyRows.has(item.row))
    : candidateResult.skipped;
  const existingConflicts = args.skipExisting
    ? await findExistingProductConflicts(candidateGroups)
    : new Map<string, string>();
  const existingSkipped = candidateGroups
    .filter((group) => existingConflicts.has(group.slug))
    .map((group) => ({
      row: group.rows[0]?.rowNumber || 0,
      brand: group.brand,
      model: group.mainModel,
      reason: existingConflicts.get(group.slug) || "already_imported"
    }));
  const availableCandidates = candidateGroups.filter((group) => !existingConflicts.has(group.slug));
  const images = new Map<string, DownloadedImage>();
  const imageSkipped: Array<{ row: number; brand: string; model: string; reason: string }> = [];
  const selected: ProductGroup[] = [];
  const selectedSlugs = new Set<string>();
  const chunkSize = Math.max(args.limit, 100);
  for (let offset = 0; selected.length < args.limit && offset < availableCandidates.length; offset += chunkSize) {
    const chunk = availableCandidates.slice(offset, offset + chunkSize);
    const chunkImages = await downloadImages(chunk, tenantToken, reportDir);
    for (const [token, image] of chunkImages) images.set(token, image);
    for (const group of chunk) {
      const imageIssue = groupImageIssue(group, images);
      if (imageIssue) {
        imageSkipped.push({
          row: group.rows[0]?.rowNumber || 0,
          brand: group.brand,
          model: group.mainModel,
          reason: imageIssue
        });
        continue;
      }
      if (selectedSlugs.has(group.slug)) {
        imageSkipped.push({
          row: group.rows[0]?.rowNumber || 0,
          brand: group.brand,
          model: group.mainModel,
          reason: "duplicate product slug already selected"
        });
        continue;
      }
      selectedSlugs.add(group.slug);
      selected.push(group);
      if (selected.length >= args.limit) break;
    }
  }
  const skipped = [...candidateSkipped, ...existingSkipped, ...imageSkipped];

  const previewRows: unknown[][] = [
    [
      "rows",
      "brand",
      "name",
      "mainModel",
      "displayName",
      "skuCodes",
      "unitPrice",
      "boxPrice",
      "category",
      "subcategory",
      "slug",
      "imageStatus",
      "sampleImagePaths",
      "packageImageStatus",
      "trayPolicy",
      "trayInternalStatus",
      "trayImagePath"
    ]
  ];
  for (const group of selected) {
    const missingTokens = [
      ...group.rows.map((row) => row.sampleToken),
      group.packageToken
    ].filter((token) => token && !images.has(token));
    previewRows.push([
      group.rows.map((row) => row.rowNumber).join("|"),
      group.brand,
      group.productName,
      group.mainModel,
      group.displayName,
      group.rows.map((row) => row.model).join("|"),
      `Uni/${moneyPt(group.unitPriceCents)}`,
      group.boxPrice || "WhatsApp",
      group.classification.categoryLabel,
      group.classification.subcategoryLabel,
      group.slug,
      missingTokens.length ? `missing ${missingTokens.length} storefront image(s)` : "ok",
      group.rows
        .map((row) => images.get(row.sampleToken)?.localPath || "")
        .filter(Boolean)
        .join("|"),
      group.packageToken
        ? images.has(group.packageToken)
          ? "available"
          : "unavailable"
        : "missing",
      "internal",
      group.trayToken && images.has(group.trayToken) ? "saved to Product.trayImage" : "missing internal tray image",
      group.trayToken ? images.get(group.trayToken)?.localPath || "" : ""
    ]);
  }
  await writeCsv(path.join(reportDir, "pilot-products-preview.csv"), previewRows);
  await writeCsv(
    path.join(reportDir, "pilot-products-skipped.csv"),
    [["row", "brand", "model", "reason"], ...skipped.map((item) => [item.row, item.brand, item.model, item.reason])]
  );
  await fs.writeFile(
    path.join(reportDir, "pilot-products-summary.json"),
    JSON.stringify(
      {
        mode: args.mode,
        sheet: sheet.title,
        readRange: args.readRange,
        onlyRows: Array.from(args.onlyRows).sort((a, b) => a - b),
        requirePackageSource: args.requirePackageSource,
        parsedRows: rows.length,
        parsedCandidateGroups: candidateResult.selected.length,
        candidateGroups: candidateGroups.length,
        skipExisting: args.skipExisting,
        existingProductsSkipped: existingSkipped.length,
        availableCandidateGroups: availableCandidates.length,
        selectedGroups: selected.length,
        skippedRows: skipped.length,
        downloadedImages: images.size,
        reportDir
      },
      null,
      2
    ),
    "utf8"
  );

  if (args.mode === "apply") {
    await applyGroups(selected, images, reportDir);
  }

  console.log(
    JSON.stringify(
      {
        mode: args.mode,
        skipExisting: args.skipExisting,
        onlyRows: Array.from(args.onlyRows).sort((a, b) => a - b),
        parsedCandidateGroups: candidateResult.selected.length,
        candidateGroups: candidateGroups.length,
        existingProductsSkipped: existingSkipped.length,
        availableCandidateGroups: availableCandidates.length,
        selectedGroups: selected.length,
        downloadedImages: images.size,
        reportDir,
        applied: args.mode === "apply"
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
