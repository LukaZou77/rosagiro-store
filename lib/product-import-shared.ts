export const productImportRequiredFields = [
  "slug",
  "name",
  "brand",
  "category",
  "subcategory",
  "price",
  "stock",
  "active",
  "image",
  "descriptionPt"
] as const;

export const productImportOptionalFields = [
  "compareAtPrice",
  "benefits",
  "ingredients",
  "badges",
  "skinType",
  "finish",
  "volume",
  "rating",
  "reviewCount"
] as const;

export type ProductImportRow = {
  rowNumber: number;
  slug: string;
  name: string;
  brand: string;
  brandSlug: string;
  category: string;
  categorySlug: string;
  subcategory: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  stock: number;
  active: boolean;
  image: string;
  descriptionPt: string;
  benefits: string[];
  ingredients: string[];
  badges: string[];
  skinType: string;
  finish: string;
  volume: string;
  rating: number;
  reviewCount: number;
  errors: string[];
};

export type ProductImportPreview = {
  headers: string[];
  rows: ProductImportRow[];
  errorCount: number;
  validCount: number;
  missingHeaders: string[];
};

const headerAliases: Record<string, string> = {
  compareatprice: "compareAtPrice",
  descriptionpt: "descriptionPt",
  reviewcount: "reviewCount"
};

function canonicalHeader(value: string) {
  const normalized = value
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/[\s_-]/g, "")
    .toLowerCase();
  return headerAliases[normalized] || normalized;
}

function detectDelimiter(line: string) {
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseCsvRows(text: string) {
  const input = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const delimiter = detectDelimiter(input.split("\n").find((line) => line.trim()) || "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && char === delimiter) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (!quoted && char === "\n") {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCents(value: string) {
  const compact = value.replace(/[R$\s]/gi, "").trim();
  if (!compact) return 0;
  const normalized =
    compact.includes(",") && compact.includes(".")
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact.replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function parseStock(value: string) {
  const stock = Number(value.replace(",", "."));
  return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : -1;
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "sim", "yes", "ativo", "active", "publicado"].includes(normalized)) return true;
  if (["0", "false", "nao", "no", "inativo", "inactive", "rascunho"].includes(normalized)) return false;
  return null;
}

function parseList(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalText(value: string, fallback: string) {
  return value.trim() || fallback;
}

function parseRating(value: string) {
  const rating = Number(value.replace(",", "."));
  if (!Number.isFinite(rating)) return 4.8;
  return Math.min(5, Math.max(0, rating));
}

function parseReviewCount(value: string) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export function parseProductCsv(text: string): ProductImportPreview {
  const rows = parseCsvRows(text);
  if (!rows.length) {
    return { headers: [], rows: [], errorCount: 1, validCount: 0, missingHeaders: [...productImportRequiredFields] };
  }

  const rawHeaders = rows[0].map(canonicalHeader);
  const missingHeaders = productImportRequiredFields.filter((field) => !rawHeaders.includes(canonicalHeader(field)));
  const importRows = rows.slice(1).map((values, index) => {
    const raw: Record<string, string> = {};
    rawHeaders.forEach((header, headerIndex) => {
      raw[header] = values[headerIndex] || "";
    });

    const errors: string[] = [];
    const slug = slugify(raw.slug || "");
    const name = raw.name?.trim() || "";
    const brand = raw.brand?.trim() || "";
    const category = raw.category?.trim() || "";
    const subcategory = raw.subcategory?.trim() || "";
    const priceCents = parseCents(raw.price || "");
    const compareAtPriceCents = raw.compareAtPrice ? parseCents(raw.compareAtPrice) : null;
    const stock = parseStock(raw.stock || "");
    const active = parseBoolean(raw.active || "");
    const image = raw.image?.trim() || "";
    const descriptionPt = raw.descriptionPt?.trim() || "";

    if (!slug) errors.push("slug obrigatorio");
    if (!name) errors.push("name obrigatorio");
    if (!brand) errors.push("brand obrigatorio");
    if (!category) errors.push("category obrigatorio");
    if (!subcategory) errors.push("subcategory obrigatorio");
    if (priceCents <= 0) errors.push("price deve ser maior que zero");
    if (compareAtPriceCents !== null && compareAtPriceCents <= 0) errors.push("compareAtPrice invalido");
    if (stock < 0) errors.push("stock invalido");
    if (active === null) errors.push("active deve ser true/false, sim/nao ou 1/0");
    if (!image) errors.push("image obrigatorio");
    if (!descriptionPt) errors.push("descriptionPt obrigatorio");

    return {
      rowNumber: index + 2,
      slug,
      name,
      brand,
      brandSlug: slugify(brand),
      category,
      categorySlug: slugify(category),
      subcategory,
      priceCents,
      compareAtPriceCents,
      stock: Math.max(0, stock),
      active: active ?? true,
      image,
      descriptionPt,
      benefits: parseList(raw.benefits || ""),
      ingredients: parseList(raw.ingredients || ""),
      badges: parseList(raw.badges || ""),
      skinType: optionalText(raw.skinType || "", "A ajustar"),
      finish: optionalText(raw.finish || "", "A ajustar"),
      volume: optionalText(raw.volume || "", "A ajustar"),
      rating: parseRating(raw.rating || ""),
      reviewCount: parseReviewCount(raw.reviewCount || ""),
      errors
    };
  });

  const rowErrorCount = importRows.reduce((total, row) => total + row.errors.length, 0);
  return {
    headers: rawHeaders,
    rows: importRows,
    errorCount: missingHeaders.length + rowErrorCount,
    validCount: importRows.filter((row) => !row.errors.length).length,
    missingHeaders
  };
}
