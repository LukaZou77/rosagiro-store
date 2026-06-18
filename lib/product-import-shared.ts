import { stockQuantityFromImport } from "@/lib/product-stock";

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
  "gallery",
  "benefits",
  "ingredients",
  "badges",
  "skinType",
  "finish",
  "volume",
  "weightGrams",
  "suggestedQuantity",
  "kitRecommendation",
  "wholesalePackage",
  "validityNote",
  "purchaseNote",
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
  hasActiveSkus?: boolean;
  active: boolean;
  deletedAt?: Date | string | null;
  brand: string;
  category: string;
  weightGrams: number | null;
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
  gallery: string[];
  descriptionPt: string;
  benefits: string[];
  ingredients: string[];
  badges: string[];
  skinType: string;
  finish: string;
  volume: string;
  weightGrams: number | null;
  suggestedQuantity: number | null;
  kitRecommendation: string | null;
  wholesalePackage: string | null;
  validityNote: string | null;
  purchaseNote: string | null;
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
  descriptionpt: "descriptionPt",
  skintype: "skinType",
  weightgrams: "weightGrams",
  suggestedquantity: "suggestedQuantity",
  kitrecommendation: "kitRecommendation",
  wholesalepackage: "wholesalePackage",
  validitynote: "validityNote",
  purchasenote: "purchaseNote",
  reviewcount: "reviewCount"
};

export const productImportTemplateRecord: ProductImportCsvRecord = {
  slug: "serum-vitamina-c-exemplo",
  name: "Serum Vitamina C Exemplo",
  brand: "RosaGiro",
  category: "rosto",
  subcategory: "Sérum facial",
  price: "89,90",
  stock: 1,
  active: true,
  image: "/assets/products/aura-serum.svg",
  gallery: "/assets/products/aura-serum.svg",
  descriptionPt: "Descrição curta do produto para a vitrine.",
  benefits: "",
  ingredients: "",
  badges: "",
  skinType: "",
  finish: "",
  volume: "",
  weightGrams: "",
  suggestedQuantity: "",
  kitRecommendation: "",
  wholesalePackage: "Venda por unidade; caixa fechada e volume maior sob consulta.",
  validityNote: "Validade e lote devem ser confirmados no recebimento do estoque real.",
  purchaseNote: "Para revenda, confirme estoque e condição de atacado pelo WhatsApp.",
  rating: "",
  reviewCount: ""
};

export const productImportHelpRows = [
  ["Campo", "Obrigatório", "Como preencher"],
  ["slug", "Sim", "Identificador único. Use letras, números e hifens. Ex: serum-vitamina-c"],
  ["name", "Sim", "Nome comercial do produto."],
  ["brand", "Sim", "Marca. Se não existir, a importação cria automaticamente."],
  ["category", "Sim", "Categoria ou slug. Ex: rosto, labios, olhos-sobrancelhas, cabelos, corpo-banho, perfumes, unhas, acessorios."],
  ["subcategory", "Sim", "Use uma subcategoria cadastrada em Categorias. Ex: Sérum facial, Base líquida, Batom líquido, Máscara de cílios."],
  ["price", "Sim", "Preço em BRL. Aceita 89,90 ou 89.90."],
  ["stock", "Sim", "Compatibilidade CSV: use 1 para Em estoque e 0 para Sem estoque. A loja não exibe quantidade real."],
  ["active", "Sim", "true/false, sim/não, 1/0, ativo/inativo."],
  ["image", "Sim", "Use /assets/..., /uploads/products/..., /placeholder... ou URL http(s)."],
  ["descriptionPt", "Sim", "Descrição em português para a vitrine."],
  ["gallery", "Não", "Até 9 imagens separadas por |. A imagem principal também entra na galeria."],
  ["benefits, ingredients, badges", "Não", "Separe vários itens com |."],
  ["skinType, finish, volume", "Não", "Texto livre para filtros e detalhe do produto."],
  ["weightGrams", "Não", "Peso unitário em gramas para cotação de frete. Deixe vazio se ainda não foi conferido."],
  ["suggestedQuantity", "Não", "Campo legado mantido para CSV antigo; não é mais necessário preencher."],
  ["kitRecommendation", "Não", "Campo legado mantido para CSV antigo; prefira usar purchaseNote para orientar compra em volume."],
  ["wholesalePackage", "Não", "Caixa fechada, pacote, grade ou condição de atacado a confirmar."],
  ["validityNote", "Não", "Informação de validade/lote ou aviso de conferência operacional."],
  ["purchaseNote", "Não", "Observação comercial para orientar compra em volume."],
  ["rating", "Não", "Nota de 0 a 5. Deixe vazio quando não houver avaliação real."],
  ["reviewCount", "Não", "Quantidade inteira de avaliações reais. Deixe vazio quando não houver."]
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
  if (["0", "false", "nao", "não", "no", "inativo", "inactive", "rascunho"].includes(normalized)) return false;
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

export const PRODUCT_GALLERY_LIMIT = 9;

function parseRating(value: string) {
  if (!value.trim()) return 0;
  const rating = Number(value.replace(",", "."));
  if (!Number.isFinite(rating)) return 0;
  return Math.min(5, Math.max(0, rating));
}

function parseReviewCount(value: string) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function parseWeightGrams(value: string) {
  const raw = value.trim();
  if (!raw) return { value: null, valid: true };
  const weight = Number(raw.replace(",", "."));
  if (!Number.isFinite(weight) || weight <= 0) return { value: null, valid: false };
  return { value: Math.max(1, Math.floor(weight)), valid: true };
}

function optionalNullableText(value: string) {
  return value.trim() || null;
}

function parseOptionalPositiveInt(value: string) {
  const raw = value.trim();
  if (!raw) return { value: null, valid: true };
  const quantity = Number(raw.replace(",", "."));
  if (!Number.isFinite(quantity) || quantity <= 0) return { value: null, valid: false };
  return { value: Math.floor(quantity), valid: true };
}

export function isAllowedProductImage(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("/assets/") || trimmed.startsWith("/uploads/products/") || trimmed.startsWith("/placeholder")) {
    return true;
  }
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeProductGallery(primaryImage: string, gallery: string[] = []) {
  const seen = new Set<string>();
  const ordered = [primaryImage, ...gallery]
    .map((image) => image.trim())
    .filter((image) => image && isAllowedProductImage(image));

  return ordered.filter((image) => {
    if (seen.has(image)) return false;
    seen.add(image);
    return true;
  }).slice(0, PRODUCT_GALLERY_LIMIT);
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
    const weight = parseWeightGrams(raw.weightGrams || "");
    const suggestedQuantity = parseOptionalPositiveInt(raw.suggestedQuantity || "");
    const stock = parseStock(raw.stock || "");
    const normalizedStock = stockQuantityFromImport(Math.max(0, stock));
    const active = parseBoolean(raw.active || "");
    const image = raw.image?.trim() || "";
    const gallery = parsePipeList(raw.gallery || "");
    const descriptionPt = raw.descriptionPt?.trim() || "";
    const existing = existingBySlug.get(slug);
    const stockDelta =
      existing && (normalizedStock > 0) !== (existing.stock > 0) ? (normalizedStock > 0 ? 1 : -1) : existing ? 0 : null;

    if (slug) slugCounts.set(slug, (slugCounts.get(slug) || 0) + 1);
    if (!slug) errors.push("slug obrigatório");
    if (!name) errors.push("name obrigatório");
    if (!brand) errors.push("brand obrigatório");
    if (!category) errors.push("category obrigatório");
    if (!subcategory) errors.push("subcategory obrigatório");
    if (priceCents <= 0) errors.push("price deve ser maior que zero");
    if (stock < 0) errors.push("stock inválido");
    if (!weight.valid) errors.push("weightGrams deve ser um número maior que zero");
    if (!suggestedQuantity.valid) errors.push("suggestedQuantity deve ser um número maior que zero quando preenchido");
    if (active === null) errors.push("active deve ser true/false, sim/não ou 1/0");
    if (!image) errors.push("image obrigatório");
    else if (!isAllowedProductImage(image)) {
      errors.push("image deve ser /assets/..., /uploads/products/..., /placeholder... ou URL http(s)");
    }
    if (Array.from(new Set([image, ...gallery].filter(Boolean))).length > PRODUCT_GALLERY_LIMIT) {
      errors.push(`gallery aceita no máximo ${PRODUCT_GALLERY_LIMIT} imagens incluindo a principal`);
    }
    for (const galleryImage of gallery) {
      if (!isAllowedProductImage(galleryImage)) {
        errors.push("gallery deve usar /assets/..., /uploads/products/..., /placeholder... ou URL http(s)");
        break;
      }
    }
    if (!descriptionPt) errors.push("descriptionPt obrigatório");
    if (existing?.deletedAt) errors.push("slug está na lixeira; restaure o produto antes de importar");

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
      compareAtPriceCents: null,
      stock: normalizedStock,
      active: active ?? true,
      image,
      gallery: normalizeProductGallery(image, gallery),
      descriptionPt,
      benefits: parsePipeList(raw.benefits || ""),
      ingredients: parsePipeList(raw.ingredients || ""),
      badges: parsePipeList(raw.badges || ""),
      skinType: (raw.skinType || "").trim(),
      finish: (raw.finish || "").trim(),
      volume: (raw.volume || "").trim(),
      weightGrams: weight.value,
      suggestedQuantity: suggestedQuantity.value,
      kitRecommendation: optionalNullableText(raw.kitRecommendation || ""),
      wholesalePackage: optionalNullableText(raw.wholesalePackage || ""),
      validityNote: optionalNullableText(raw.validityNote || ""),
      purchaseNote: optionalNullableText(raw.purchaseNote || ""),
      rating: parseRating(raw.rating || ""),
      reviewCount: parseReviewCount(raw.reviewCount || ""),
      operation,
      stockDelta,
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
