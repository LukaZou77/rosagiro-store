export type ProductSubcategorySeed = {
  categorySlug: string;
  labels: string[];
};

export const productSubcategorySeeds: ProductSubcategorySeed[] = [
  {
    categorySlug: "rosto",
    labels: [
      "Base líquida",
      "Corretivo",
      "Primer facial",
      "Pó compacto",
      "Blush",
      "Iluminador em pó",
      "Pó de contorno",
      "Contorno cremoso",
      "Pó de contorno perolado",
      "Sérum facial",
      "Água micelar",
      "Óleo demaquilante",
      "Espuma de limpeza facial",
      "Gel de limpeza facial",
      "Esfoliante facial",
      "Tônico facial",
      "Creme facial",
      "Multifuncional rosto, olhos e lábios"
    ]
  },
  {
    categorySlug: "olhos-sobrancelhas",
    labels: [
      "Delineador em lápis",
      "Máscara de cílios",
      "Sérum para cílios",
      "Paleta de sombras",
      "Sombra unitária",
      "Lápis para sobrancelhas",
      "Sombra para sobrancelhas",
      "Gel para sobrancelhas",
      "Gel fixador de sobrancelhas",
      "Máscara para sobrancelhas"
    ]
  },
  {
    categorySlug: "labios",
    labels: ["Batom", "Batom líquido", "Balm labial", "Óleo labial", "Lápis labial", "Gloss labial", "Batom glow hidratante"]
  },
  {
    categorySlug: "corpo-banho",
    labels: [
      "Sabonete líquido corporal",
      "Desodorante corporal",
      "Desodorante corporal spray",
      "Esfoliante corporal",
      "Creme hidratante corporal",
      "Loção corporal",
      "Óleo corporal",
      "Creme corporal perfumado",
      "Creme para mãos"
    ]
  },
  {
    categorySlug: "cabelos",
    labels: [
      "Shampoo",
      "Condicionador",
      "Máscara de tratamento",
      "Finalizador capilar",
      "Óleo capilar",
      "Acessórios para cabelo"
    ]
  },
  {
    categorySlug: "perfumes",
    labels: ["Perfume", "Body splash"]
  },
  {
    categorySlug: "acessorios",
    labels: [
      "Pincel de maquiagem",
      "Puff de maquiagem",
      "Esponja de maquiagem",
      "Discos de algodão",
      "Lenços demaquilantes",
      "Nécessaire"
    ]
  },
  {
    categorySlug: "unhas",
    labels: []
  }
];

export function normalizeSubcategoryText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function subcategorySlug(value: string) {
  return normalizeSubcategoryText(value).replace(/\s+/g, "-").slice(0, 80) || "subcategoria";
}

export function findSeedSubcategoryLabel(categorySlug: string, value: string | null | undefined) {
  const normalized = normalizeSubcategoryText(value);
  if (!normalized) return null;
  const seed = productSubcategorySeeds.find((item) => item.categorySlug === categorySlug);
  return seed?.labels.find((label) => normalizeSubcategoryText(label) === normalized) || null;
}
