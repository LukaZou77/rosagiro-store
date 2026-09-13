import { isSourceCatalogConsultationProduct } from "./source-catalog-product";

type StockQualityProduct = {
  active: boolean;
  stockStatus?: string | null;
};

export function productStockQualityIssue(product: StockQualityProduct, stock: number) {
  if (isSourceCatalogConsultationProduct(product)) {
    return {
      key: "consultation-stock-review",
      group: "operation" as const,
      severity: "low" as const,
      label: "Estoque sob consulta",
      message: "Confirme manualmente o estoque antes de liberar a compra deste item."
    };
  }

  if (product.active && stock <= 0) {
    return {
      key: "active-out-of-stock",
      group: "operation" as const,
      severity: "high" as const,
      label: "Ativo sem estoque",
      message: "Produto ativo sem estoque pode frustrar compra e pagamento."
    };
  }

  return null;
}
