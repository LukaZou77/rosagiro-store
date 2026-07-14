import { money } from "@/lib/money";

export const CUSTOMER_CATALOG_PAGE_SIZE = 50;
export const CATALOG_WHOLESALE_CONSULT_TEXT = "Condição de atacado: consulte no WhatsApp.";
export const CATALOG_STOCK_AVAILABLE_TEXT = "Estoque disponível";
export const CATALOG_STOCK_CHECK_TEXT = "Consulte disponibilidade";
export const CATALOG_NATIONAL_SHIPPING_TEXT = "Envio para todo o Brasil";

export type CustomerCatalogDownloadProduct = {
  id: string;
  name: string;
  subcategory: string;
  priceCents: number;
  wholesalePackage: string | null;
  image: string;
  mpn: string | null;
  inStock: boolean;
  brandName: string;
  categoryLabel: string;
  skus: CustomerCatalogSkuInput[];
};

export type CustomerCatalogDownloadGroup = {
  id: string;
  slug: string;
  label: string;
  products: CustomerCatalogDownloadProduct[];
};

export type CustomerCatalogDownloadData = {
  brand: { id: string; name: string };
  productCount: number;
  skuCount: number;
  groups: CustomerCatalogDownloadGroup[];
};

export type CustomerCatalogCompleteDownloadData = {
  productCount: number;
  skuCount: number;
  brands: CustomerCatalogDownloadData[];
};

export type CustomerCatalogPriceStatus = "all" | "priced" | "consult";

export type CustomerCatalogSkuInput = {
  id: string;
  name: string;
  code: string;
  image: string | null;
  priceCents: number | null;
};

export type CustomerCatalogSkuRow = {
  id: string;
  name: string;
  code: string;
  image: string;
  priceCents: number;
};

export function singleCatalogParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeCatalogQuery(value: string | string[] | undefined) {
  return (singleCatalogParam(value) || "").trim().slice(0, 120);
}

export function normalizeCatalogPriceStatus(value: string | string[] | undefined): CustomerCatalogPriceStatus {
  const normalized = singleCatalogParam(value);
  return normalized === "priced" || normalized === "consult" ? normalized : "all";
}

export function normalizeCatalogPage(value: string | string[] | undefined) {
  const parsed = Number(singleCatalogParam(value) || "1");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export function hasCatalogWholesalePrice(wholesalePackage: string | null | undefined) {
  return /R\$\s*\d/i.test(wholesalePackage || "");
}

export function catalogWholesaleLabel(wholesalePackage: string | null | undefined) {
  const normalized = wholesalePackage?.trim() || "";
  if (!hasCatalogWholesalePrice(normalized)) return CATALOG_WHOLESALE_CONSULT_TEXT;

  return normalized.replace(/^caixa\s+com\s+/i, "Embalagem fechada com ");
}

export function catalogStockLabel(inStock: boolean) {
  return inStock ? CATALOG_STOCK_AVAILABLE_TEXT : CATALOG_STOCK_CHECK_TEXT;
}

export function catalogSkuRows(input: {
  productImage: string;
  productPriceCents: number;
  mpn?: string | null;
  skus: CustomerCatalogSkuInput[];
}): CustomerCatalogSkuRow[] {
  const seen = new Set<string>();
  const rows: CustomerCatalogSkuRow[] = [];

  for (const sku of input.skus) {
    const code = sku.code.trim() || sku.name.trim();
    if (!code) continue;
    const key = code.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: sku.id,
      name: sku.name.trim() || code,
      code,
      image: sku.image?.trim() || input.productImage,
      priceCents: sku.priceCents ?? input.productPriceCents
    });
  }

  if (rows.length) return rows;

  const fallbackCode = input.mpn?.trim() || "Modelo não informado";
  return [
    {
      id: "product-model",
      name: fallbackCode,
      code: fallbackCode,
      image: input.productImage,
      priceCents: input.productPriceCents
    }
  ];
}

export function catalogUnitPriceLabel(productPriceCents: number, skus: CustomerCatalogSkuInput[]) {
  const prices = skus.length
    ? skus.map((sku) => sku.priceCents ?? productPriceCents)
    : [productPriceCents];
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  return minimum === maximum ? money(minimum) : `${money(minimum)} a ${money(maximum)}`;
}

export function customerCatalogBrandFileName(brandName: string) {
  const normalized = brandName
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 80);

  return normalized || "RosaGiro";
}

export function customerCatalogDocumentTitle(brandName: string) {
  return customerCatalogBrandFileName(brandName);
}

export function customerCatalogCompleteFileName() {
  return "Catalogo completo RosaGiro.pdf";
}
