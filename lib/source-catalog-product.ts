export const SOURCE_CATALOG_CONSULTATION_STATUS = "Sob consulta";

export type SourceCatalogMarker = {
  stockStatus?: string | null;
};

export type VerifiedSaleUnit = "unidade" | "pacote" | "kit" | "conjunto" | "cartela" |
  "miniembalagem" | "embalagem de lenços" | "estojo" | "maleta";

const SALE_UNIT_PATTERN = /^Unidade de venda: (unidade|pacote|kit|conjunto|cartela|miniembalagem|embalagem de lenços|estojo|maleta)\./i;

export function isSourceCatalogConsultationProduct(product: SourceCatalogMarker) {
  return product.stockStatus === SOURCE_CATALOG_CONSULTATION_STATUS;
}

export function sourceCatalogVerifiedSaleUnit(wholesalePackage?: string | null): VerifiedSaleUnit | null {
  const match = wholesalePackage?.trim().match(SALE_UNIT_PATTERN);
  return (match?.[1]?.toLocaleLowerCase("pt-BR") as VerifiedSaleUnit | undefined) || null;
}

export function sourceCatalogPriceLabel(wholesalePackage?: string | null) {
  const saleUnit = sourceCatalogVerifiedSaleUnit(wholesalePackage);
  if (saleUnit === "unidade") return "Preço unitário";
  if (saleUnit) return `Preço por ${saleUnit}`;
  return "Preço unitário da imagem";
}

export function sourceCatalogPackageText(wholesalePackage?: string | null) {
  return wholesalePackage?.trim().replace(SALE_UNIT_PATTERN, "").trim() || "";
}
