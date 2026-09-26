// Verified against the supplier board and the live 2172.1.1 sample photos.
// The differently written 217211-01 record still requires separate review.
export const productCanonicalAliases: Readonly<Record<string, string>> = {
  "paleta-de-sombra-glitter-12-cores-vivai-2172-1-1": "vivai-estojo-de-glitter-12-cores-2172-1-1"
};

type CanonicalProduct = {
  slug: string;
  active: boolean;
  priceCents: number;
  baseBoxPieces: number | null;
  baseBoxPriceCents: number | null;
  brand: { name: string };
};

export function verifiedProductCanonicalSlug(product: CanonicalProduct, target?: CanonicalProduct | null) {
  if (!target?.active || productCanonicalAliases[product.slug] !== target.slug) return product.slug;
  if (
    !product.baseBoxPieces || !product.baseBoxPriceCents ||
    product.priceCents !== target.priceCents ||
    product.baseBoxPieces !== target.baseBoxPieces ||
    product.baseBoxPriceCents !== target.baseBoxPriceCents ||
    product.brand.name.toLocaleLowerCase("pt-BR") !== target.brand.name.toLocaleLowerCase("pt-BR")
  ) return product.slug;
  return target.slug;
}
