export const checkoutShippingMethods = ["MELHOR_ENVIO", "RETIRADA_LOCAL"] as const;

export type CheckoutShippingMethod = (typeof checkoutShippingMethods)[number];

export const shippingWeightConfig = {
  packagingWeightGrams: 150,
  minBillableWeightGrams: 100,
  fallbackProductWeightGrams: 150
} as const;

export type ProductShippingProfileInput = {
  name: string;
  categorySlug?: string | null;
  weightGrams?: number | null;
};

export type ProductShippingProfile = {
  widthCm: number;
  heightCm: number;
  lengthCm: number;
  weightGrams: number;
  source: "confirmed-weight" | "technical-profile";
};

type TechnicalProfile = Omit<ProductShippingProfile, "source">;

const categoryProfiles: Record<string, TechnicalProfile> = {
  labios: { widthCm: 4, heightCm: 4, lengthCm: 14, weightGrams: 65 },
  "olhos-sobrancelhas": { widthCm: 5, heightCm: 4, lengthCm: 16, weightGrams: 85 },
  rosto: { widthCm: 8, heightCm: 5, lengthCm: 13, weightGrams: 140 },
  perfumes: { widthCm: 9, heightCm: 7, lengthCm: 17, weightGrams: 280 },
  "corpo-banho": { widthCm: 9, heightCm: 7, lengthCm: 19, weightGrams: 300 },
  acessorios: { widthCm: 12, heightCm: 7, lengthCm: 17, weightGrams: 180 }
};

const fallbackProfile: TechnicalProfile = {
  widthCm: 8,
  heightCm: 6,
  lengthCm: 15,
  weightGrams: shippingWeightConfig.fallbackProductWeightGrams
};

function normalizedProductText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function technicalProfileForName(name: string, categorySlug?: string | null): TechnicalProfile {
  const normalized = normalizedProductText(name);

  if (/\b(kit|estojo|maleta)\b/.test(normalized)) {
    return { widthCm: 22, heightCm: 8, lengthCm: 28, weightGrams: 550 };
  }
  if (/\b(paleta|palette)\b/.test(normalized)) {
    return { widthCm: 18, heightCm: 4, lengthCm: 24, weightGrams: 280 };
  }
  if (/\b(esponja|blender|pincel|aplicador)\b/.test(normalized)) {
    return { widthCm: 9, heightCm: 6, lengthCm: 14, weightGrams: 80 };
  }
  if (/\b(perfume|colonia|body splash)\b/.test(normalized)) {
    return categoryProfiles.perfumes;
  }
  if (/\b(shampoo|condicionador|hidratante|creme corporal|sabonete liquido)\b/.test(normalized)) {
    return categoryProfiles["corpo-banho"];
  }

  return categoryProfiles[String(categorySlug || "").toLowerCase()] || fallbackProfile;
}

export function parseCheckoutShippingMethod(value: unknown): CheckoutShippingMethod | null {
  const normalized = String(value || "").trim().toUpperCase();
  return checkoutShippingMethods.includes(normalized as CheckoutShippingMethod)
    ? (normalized as CheckoutShippingMethod)
    : null;
}

export function productWeightGrams(weightGrams: number | null | undefined) {
  if (!weightGrams || weightGrams <= 0) return shippingWeightConfig.fallbackProductWeightGrams;
  return Math.max(1, Math.floor(weightGrams));
}

export function productShippingProfile(input: ProductShippingProfileInput): ProductShippingProfile {
  const technical = technicalProfileForName(input.name, input.categorySlug);
  const hasConfirmedWeight = Boolean(input.weightGrams && input.weightGrams > 0);

  return {
    ...technical,
    weightGrams: hasConfirmedWeight ? Math.max(1, Math.floor(input.weightGrams || 0)) : technical.weightGrams,
    source: hasConfirmedWeight ? "confirmed-weight" : "technical-profile"
  };
}

export function billableWeightGrams(productTotalWeightGrams: number) {
  return Math.max(
    shippingWeightConfig.minBillableWeightGrams,
    productTotalWeightGrams + shippingWeightConfig.packagingWeightGrams
  );
}
