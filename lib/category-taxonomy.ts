export const BODY_AREA_CATEGORIES = [
  {
    slug: "rosto",
    label: "Rosto",
    note: "Base, corretivo, pó, blush, iluminador, primer e skincare facial."
  },
  {
    slug: "olhos-sobrancelhas",
    label: "Olhos e Sobrancelhas",
    note: "Sombras, delineadores, máscaras, cílios e itens para sobrancelha."
  },
  {
    slug: "labios",
    label: "Lábios",
    note: "Batons, gloss, balm, lápis labial e produtos para boca."
  },
  {
    slug: "cabelos",
    label: "Cabelos",
    note: "Shampoo, tratamento, finalizadores, óleos e acessórios capilares."
  },
  {
    slug: "corpo-banho",
    label: "Corpo e Banho",
    note: "Hidratantes, sabonetes, banho e cuidados corporais."
  },
  {
    slug: "perfumes",
    label: "Perfumes",
    note: "Perfumes, colônias, body splash e brumas perfumadas."
  },
  {
    slug: "unhas",
    label: "Unhas",
    note: "Esmaltes, bases, cuidados e acessórios de manicure."
  },
  {
    slug: "acessorios",
    label: "Acessórios",
    note: "Pincéis, esponjas, nécessaires e ferramentas de apoio."
  }
] as const;

export const BODY_AREA_CATEGORY_ORDER: string[] = BODY_AREA_CATEGORIES.map((category) => category.slug);

export const LEGACY_CATEGORY_SLUGS = ["skincare", "makeup", "fragrance", "body", "hair", "tools"] as const;

const bodyAreaBySlug: Map<string, (typeof BODY_AREA_CATEGORIES)[number]> = new Map(
  BODY_AREA_CATEGORIES.map((category) => [category.slug, category])
);

function normalizeText(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasAnyKeyword(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

export function getBodyAreaCategory(slug: string) {
  return bodyAreaBySlug.get(slug);
}

export function resolveBodyAreaCategorySlug(input: {
  categorySlug?: string | null;
  categoryLabel?: string | null;
  subcategory?: string | null;
  name?: string | null;
}) {
  const categorySlug = normalizeText(input.categorySlug).replace(/\s+/g, "-");
  if (bodyAreaBySlug.has(categorySlug)) return categorySlug;

  const text = normalizeText([input.categorySlug, input.categoryLabel, input.subcategory, input.name].filter(Boolean).join(" "));

  if (categorySlug === "fragrance" || hasAnyKeyword(text, ["perfume", "colonia", "body splash", "bruma perfumada"])) {
    return "perfumes";
  }
  if (categorySlug === "body" || hasAnyKeyword(text, ["corpo", "banho", "hidratante", "sabonete"])) {
    return "corpo-banho";
  }
  if (categorySlug === "hair" || hasAnyKeyword(text, ["cabelo", "cabelos", "capilar", "shampoo", "condicionador"])) {
    return "cabelos";
  }
  if (categorySlug === "tools" || hasAnyKeyword(text, ["pincel", "pinceis", "esponja", "necessaire", "ferramenta"])) {
    return "acessorios";
  }
  if (hasAnyKeyword(text, ["unha", "unhas", "esmalte", "manicure"])) {
    return "unhas";
  }
  if (categorySlug === "makeup" && hasAnyKeyword(text, ["labio", "labios", "boca", "batom", "gloss", "balm", "labial"])) {
    return "labios";
  }
  if (
    categorySlug === "makeup" &&
    hasAnyKeyword(text, ["olho", "olhos", "sombra", "mascara", "delineador", "sobrancelha", "cilio", "cilios"])
  ) {
    return "olhos-sobrancelhas";
  }
  if (categorySlug === "skincare" || categorySlug === "makeup") {
    return "rosto";
  }

  return categorySlug || "rosto";
}
