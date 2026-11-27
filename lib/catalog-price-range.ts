export const catalogPriceRanges = {
  "under-1": { label: "Abaixo de R$ 1", minCents: 1, maxCents: 100 },
  "1-5": { label: "R$ 1 a menos de R$ 5", minCents: 100, maxCents: 500 },
  "5-10": { label: "R$ 5 a menos de R$ 10", minCents: 500, maxCents: 1000 },
  "10-15": { label: "R$ 10 a menos de R$ 15", minCents: 1000, maxCents: 1500 },
  "15-20": { label: "R$ 15 a menos de R$ 20", minCents: 1500, maxCents: 2000 },
  "20-25": { label: "R$ 20 a menos de R$ 25", minCents: 2000, maxCents: 2500 },
  "25-plus": { label: "R$ 25 ou mais", minCents: 2500, maxCents: Infinity }
} as const;

export type CatalogPriceRange = "all" | keyof typeof catalogPriceRanges;

export function parseCatalogPriceRange(value: string | undefined): CatalogPriceRange {
  return value && Object.hasOwn(catalogPriceRanges, value) ? value as keyof typeof catalogPriceRanges : "all";
}

export function matchesCatalogPriceRange(priceCents: number, range: CatalogPriceRange): boolean {
  if (range === "all") return true;
  const { minCents, maxCents } = catalogPriceRanges[range];
  return priceCents >= minCents && priceCents < maxCents;
}
