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

export const productImportFields = [...productImportRequiredFields, ...productImportOptionalFields] as const;

export type ProductImportField = (typeof productImportFields)[number];

export type ProductImportExistingProduct = {
  slug: string;
  name: string;
  priceCents: number;
  stock: number;
  active: boolean;
  brand: string;
  category: string;
};

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
  operation: "create" | "update";
  stockDelta: number | null;
  priceDeltaCents: number | null;
  duplicateSlug: boolean;
  errors: string[];
};

export type ProductImportPreview = {
  headers: string[];
  rows: ProductImportRow[];
  errorCount: number;
  validCount: number;
  missingHeaders: string[];
  summary: {
    totalRows: number;
    createCount: number;
    updateCount: number;
    duplicateSlugCount: number;
    stockChangeCount: number;
    priceChangeCount: number;
  };
};

export type ProductImportCsvRecord = Record<ProductImportField, string | number | boolean | null | undefined>;

const headerAliases: Record<string, ProductImportField> = {
  compareatprice: "compareAtPrice",
  descriptionpt: "descriptionPt",
  reviewcount: "reviewCount"
};

export const productImportTemplateRecord: ProductImportCsvRecord = {
  slug: "serum-vitamina-c-exemplo",
  name: "Serum Vitamina C Exemplo",
  brand: "Bela Viva",
  category: "skincare",
  subcategory: "Serum",
  price: "89,90",
  stock: 24,
  active: true,
  image: "/assets/products/aura-serum.svg",
  descriptionPt: "Descricao curta do produto para a vitrine.",
  compareAtPrice: "109,90",
  benefits: "Luminosidade|Textura leve",
  ingredients: "Vitamina C|Acido hialuronico",
  badges: "Novo|Favorito",
  skinType: "Todos os tipos",
  finish: "Glow",
  volume: "30 ml",
  rating: "4,8",
  reviewCount: 12
};

export const productImportHelpRows = [
  ["Campo", "Obrigatorio", "Como preencher"],
  ["slug", "Sim", "Identificador unico. Use letras, numeros e hifens. Ex: serum-vitamina-c"],
  ["name", "Sim", "Nome comercial do produto."],
  ["brand", "Sim", "Marca. Se nao existir, a importacao cria automaticamente."],
  ["category", "Sim", "Categoria ou slug da categoria. Ex: skincare, maquiagem, perfumes."],
  ["subcategory", "Sim", "Grupo de prateleira. Ex: Serum, Base, Batom, Pincel."],
  ["price", "Sim", "Preco em BRL. Aceita 89,90 ou 89.90."],
  ["stock", "Sim", "Quantidade inteira em estoque."],
  ["active", "Sim", "true/false, sim/nao, 1/0, ativo/inativo."],
  ["image", "Sim", "Use /assets/..., /placeholder... ou URL http(s)."],
  ["descriptionPt", "Sim", "Descricao em portugues para a vitrine."],
  ["compareAtPrice", "Nao", "Preco comparativo maior que o preco atual."],
  ["benefits, ingredients, badges", "Nao", "Separe varios itens com |."],
  ["skinType, finish, volume", "Nao", "Texto livre para filtros e detalhe do produto."],
  ["rating", "Nao", "Nota de 0 a 5. Padrao 4,8 quando vazio."],
  ["reviewCount", "Nao", "Quantidade inteira de avaliacoes."]
] as const;

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

export function formatImportMoney(cents: number | null | undefined) {
  if (!cents) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function parseCents(value: string) {
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
  return Number.isFinite(stock) ? Math.floor(stock) : -1;
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "sim", "yes", "ativo", "active", "publicado"].includes(normalized)) return true;
  if (["0", "false", "nao", "no", "inativo", "inactive", "rascunho"].includes(normalized)) return false;
  return null;
}

export function parsePipeList(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function pipeListValue(values: string[] | null | undefined) {
  return (values || []).join("|");
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

export function isAllowedProductImage(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("/assets/") || trimmed.startsWith("/placeholder")) return true;
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function emptyPreview(errorCount: number): ProductImportPreview {
  return {
    headers: [],
    rows: [],
    errorCount,
    validCount: 0,
    missingHeaders: [...productImportRequiredFields],
    summary: {
      totalRows: 0,
      createCount: 0,
      updateCount: 0,
      duplicateSlugCount: 0,
      stockChangeCount: 0,
      priceChangeCount: 0
    }
  };
}

export function parseProductCsv(
  text: string,
  options: { existingProducts?: ProductImportExistingProduct[] } = {}
): ProductImportPreview {
  const rows = parseCsvRows(text);
  if (!rows.length) return emptyPreview(1);

  const existingBySlug = new Map((options.existingProducts || []).map((product) => [product.slug, product]));
  const rawHeaders = rows[0].map(canonicalHeader);
  const missingHeaders = productImportRequiredFields.filter((field) => !rawHeaders.includes(canonicalHeader(field)));
  const slugCounts = new Map<string, number>();
  const importRows: ProductImportRow[] = rows.slice(1).map((values, index) => {
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
    const existing = existingBySlug.get(slug);

    if (slug) slugCounts.set(slug, (slugCounts.get(slug) || 0) + 1);
    if (!slug) errors.push("slug obrigatorio");
    if (!name) errors.push("name obrigatorio");
    if (!brand) errors.push("brand obrigatorio");
    if (!category) errors.push("category obrigatorio");
    if (!subcategory) errors.push("subcategory obrigatorio");
    if (priceCents <= 0) errors.push("price deve ser maior que zero");
    if (compareAtPriceCents !== null && compareAtPriceCents <= priceCents) {
      errors.push("compareAtPrice deve ser maior que price");
    }
    if (stock < 0) errors.push("stock invalido");
    if (active === null) errors.push("active deve ser true/false, sim/nao ou 1/0");
    if (!image) errors.push("image obrigatorio");
    else if (!isAllowedProductImage(image)) errors.push("image deve ser /assets/..., /placeholder... ou URL http(s)");
    if (!descriptionPt) errors.push("descriptionPt obrigatorio");

    const operation: ProductImportRow["operation"] = existing ? "update" : "create";

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
      benefits: parsePipeList(raw.benefits || ""),
      ingredients: parsePipeList(raw.ingredients || ""),
      badges: parsePipeList(raw.badges || ""),
      skinType: optionalText(raw.skinType || "", "A ajustar"),
      finish: optionalText(raw.finish || "", "A ajustar"),
      volume: optionalText(raw.volume || "", "A ajustar"),
      rating: parseRating(raw.rating || ""),
      reviewCount: parseReviewCount(raw.reviewCount || ""),
      operation,
      stockDelta: existing ? Math.max(0, stock) - existing.stock : null,
      priceDeltaCents: existing ? priceCents - existing.priceCents : null,
      duplicateSlug: false,
      errors
    };
  });

  for (const row of importRows) {
    if (row.slug && (slugCounts.get(row.slug) || 0) > 1) {
      row.duplicateSlug = true;
      row.errors.push("slug duplicado no CSV");
    }
  }

  const rowErrorCount = importRows.reduce((total, row) => total + row.errors.length, 0);
  return {
    headers: rawHeaders,
    rows: importRows,
    errorCount: missingHeaders.length + rowErrorCount,
    validCount: importRows.filter((row) => !row.errors.length).length,
    missingHeaders,
    summary: {
      totalRows: importRows.length,
      createCount: importRows.filter((row) => row.operation === "create").length,
      updateCount: importRows.filter((row) => row.operation === "update").length,
      duplicateSlugCount: importRows.filter((row) => row.duplicateSlug).length,
      stockChangeCount: importRows.filter((row) => row.stockDelta !== null && row.stockDelta !== 0).length,
      priceChangeCount: importRows.filter((row) => row.priceDeltaCents !== null && row.priceDeltaCents !== 0).length
    }
  };
}

function csvEscape(value: string | number | boolean | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function recordsToProductCsv(records: ProductImportCsvRecord[]) {
  const lines = [productImportFields.map(csvEscape).join(",")];
  for (const record of records) {
    lines.push(productImportFields.map((field) => csvEscape(record[field])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function productImportTemplateCsv() {
  return recordsToProductCsv([productImportTemplateRecord]);
}
