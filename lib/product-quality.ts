import "server-only";

import type { Prisma } from "@/src/generated/prisma/client";
import { prisma } from "@/lib/db";
import { normalizeProductGallery } from "@/lib/product-import-shared";

export type ProductQualityStatus = "READY" | "REVIEW" | "ACTION_REQUIRED";
export type ProductQualitySeverity = "low" | "medium" | "high";
export type ProductQualityGroup = "media" | "content" | "wholesale" | "operation" | "promotion" | "launch";

export type ProductQualityIssue = {
  key: string;
  group: ProductQualityGroup;
  severity: ProductQualitySeverity;
  label: string;
  message: string;
};

export type ProductQualityResult = {
  slug: string;
  name: string;
  active: boolean;
  status: ProductQualityStatus;
  statusLabel: string;
  statusMessage: string;
  issues: ProductQualityIssue[];
  galleryCount: number;
  stock: number;
  hasRealDiscount: boolean;
  primaryImage: string;
};

export type ProductQualitySummary = {
  total: number;
  readyCount: number;
  reviewCount: number;
  actionRequiredCount: number;
  activeCount: number;
  localUploadCount: number;
  svgDemoCount: number;
  defaultWeightCount: number;
  wholesaleIssueCount: number;
  issueCounts: Array<ProductQualityIssue & { count: number }>;
  items: ProductQualityResult[];
};

export type ProductWithQualityRelations = Prisma.ProductGetPayload<{
  include: { brand: true; category: true; inventory: true };
}>;

export const productQualityStatusLabels: Record<ProductQualityStatus, string> = {
  READY: "Pronto",
  REVIEW: "Revisar",
  ACTION_REQUIRED: "Ação necessária"
};

export const productQualityGroupLabels: Record<ProductQualityGroup, string> = {
  media: "Mídia",
  content: "Conteúdo",
  wholesale: "Atacado",
  operation: "Operação",
  promotion: "Promoção",
  launch: "Publicação"
};

const PLACEHOLDER_PATTERN = /placeholder/i;
const ADJUST_PATTERN = /a ajustar|exemplo|preparacao|prepara\u00e7\u00e3o|teste|demo/i;
const WHOLESALE_DRAFT_PATTERN = /a ajustar|exemplo|preparacao|prepara\u00e7\u00e3o|teste|demo|a confirmar|sob consulta|conferencia|confer\u00eancia/i;
const MIN_DESCRIPTION_LENGTH = 80;
const MIN_GALLERY_IMAGES = 3;
const DEFAULT_WEIGHT_GRAMS = 150;

function textLooksDraft(value: string | null | undefined) {
  return !value?.trim() || ADJUST_PATTERN.test(value);
}

function wholesaleTextLooksDraft(value: string | null | undefined) {
  return !value?.trim() || WHOLESALE_DRAFT_PATTERN.test(value);
}

function listLooksDraft(values: string[] | null | undefined, minItems: number) {
  return !values || values.length < minItems || values.some((value) => textLooksDraft(value));
}

function issue(input: ProductQualityIssue): ProductQualityIssue {
  return input;
}

function statusFromIssues(issues: ProductQualityIssue[]): ProductQualityStatus {
  if (issues.some((item) => item.severity === "high")) return "ACTION_REQUIRED";
  if (issues.length) return "REVIEW";
  return "READY";
}

function statusMessage(status: ProductQualityStatus) {
  if (status === "READY") return "Ficha pronta para revisão final de venda.";
  if (status === "ACTION_REQUIRED") return "Precisa corrigir itens importantes antes de vender.";
  return "Boa base, mas ainda precisa de conferências operacionais.";
}

export function evaluateProductQuality(product: ProductWithQualityRelations): ProductQualityResult {
  const gallery = normalizeProductGallery(product.image, product.gallery);
  const stock = product.inventory?.quantity || 0;
  const hasRealDiscount = Boolean(product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents);
  const issues: ProductQualityIssue[] = [];

  if (!product.image || PLACEHOLDER_PATTERN.test(product.image)) {
    issues.push(
      issue({
        key: "missing-primary-image",
        group: "media",
        severity: "high",
        label: "Imagem principal ausente",
        message: "Substitua placeholder ou imagem vazia por foto real do produto."
      })
    );
  } else if (product.image.startsWith("/assets/products/") && product.image.endsWith(".svg")) {
    issues.push(
      issue({
        key: "demo-svg-image",
        group: "media",
        severity: "high",
        label: "Imagem de demonstração",
        message: "A vitrine ainda usa SVG de protótipo; envie fotos reais antes da venda."
      })
    );
  }

  if (gallery.length < MIN_GALLERY_IMAGES) {
    issues.push(
      issue({
        key: "gallery-too-small",
        group: "media",
        severity: "medium",
        label: "Galeria curta",
        message: `Use pelo menos ${MIN_GALLERY_IMAGES} fotos para mostrar frente, verso e detalhe.`
      })
    );
  }

  if (product.image.startsWith("/uploads/products/")) {
    issues.push(
      issue({
        key: "local-upload-storage",
        group: "launch",
        severity: "medium",
        label: "Imagem local",
        message: "Upload local funciona no desenvolvimento, mas precisa migrar para storage persistente na produção."
      })
    );
  }

  if (product.descriptionPt.trim().length < MIN_DESCRIPTION_LENGTH || textLooksDraft(product.descriptionPt)) {
    issues.push(
      issue({
        key: "weak-description",
        group: "content",
        severity: "medium",
        label: "Descrição incompleta",
        message: "Inclua descrição comercial clara, uso, benefício e contexto de compra no atacado."
      })
    );
  }

  if (listLooksDraft(product.benefits, 2)) {
    issues.push(
      issue({
        key: "missing-benefits",
        group: "content",
        severity: "medium",
        label: "Benefícios a revisar",
        message: "Preencha pelo menos dois benefícios reais separados para a vitrine."
      })
    );
  }

  if (listLooksDraft(product.ingredients, 1)) {
    issues.push(
      issue({
        key: "missing-ingredients",
        group: "content",
        severity: "medium",
        label: "Ingredientes a revisar",
        message: "Informe composição, ativo principal ou material para reduzir dúvidas no WhatsApp."
      })
    );
  }

  if (textLooksDraft(product.skinType) || textLooksDraft(product.finish) || textLooksDraft(product.volume)) {
    issues.push(
      issue({
        key: "missing-attributes",
        group: "content",
        severity: "medium",
        label: "Atributos incompletos",
        message: "Revise tipo de pele/uso, acabamento/textura e volume/tamanho."
      })
    );
  }

  if (textLooksDraft(product.brand.origin) || textLooksDraft(product.brand.descriptionPt)) {
    issues.push(
      issue({
        key: "brand-data-draft",
        group: "content",
        severity: "low",
        label: "Marca sem ficha real",
        message: "Complete origem e descrição da marca para melhorar confiança e filtros."
      })
    );
  }

  if (textLooksDraft(product.category.note)) {
    issues.push(
      issue({
        key: "category-data-draft",
        group: "content",
        severity: "low",
        label: "Categoria sem descrição",
        message: "Complete a nota da categoria para orientar compra por prateleira."
      })
    );
  }

  if (!product.suggestedQuantity || product.suggestedQuantity <= 0) {
    issues.push(
      issue({
        key: "missing-suggested-quantity",
        group: "wholesale",
        severity: "medium",
        label: "Quantidade sugerida ausente",
        message: "Informe uma quantidade sugerida para orientar compra de reposição ou revenda."
      })
    );
  }

  if (wholesaleTextLooksDraft(product.kitRecommendation)) {
    issues.push(
      issue({
        key: "missing-kit-recommendation",
        group: "wholesale",
        severity: "medium",
        label: "Kit recomendado a revisar",
        message: "Inclua combinação real para kit, rotina ou reposição sem prometer desconto automático."
      })
    );
  }

  if (wholesaleTextLooksDraft(product.wholesalePackage)) {
    issues.push(
      issue({
        key: "missing-wholesale-package",
        group: "wholesale",
        severity: "medium",
        label: "Atacado/caixa sem regra real",
        message: "Preencha caixa fechada, pacote, grade ou condição de atacado que a equipe possa confirmar."
      })
    );
  }

  if (wholesaleTextLooksDraft(product.validityNote)) {
    issues.push(
      issue({
        key: "missing-validity-note",
        group: "wholesale",
        severity: "medium",
        label: "Validade/lote a confirmar",
        message: "Inclua validade mínima, lote ou regra clara de conferência antes de vender."
      })
    );
  }

  if (textLooksDraft(product.purchaseNote)) {
    issues.push(
      issue({
        key: "missing-purchase-note",
        group: "wholesale",
        severity: "low",
        label: "Observação de compra vazia",
        message: "Adicione uma nota curta para orientar volume, revenda, retirada ou consulta por WhatsApp."
      })
    );
  }

  if (product.priceCents <= 0) {
    issues.push(
      issue({
        key: "invalid-price",
        group: "operation",
        severity: "high",
        label: "Preço inválido",
        message: "Produto precisa de preço maior que zero para checkout."
      })
    );
  }

  if (product.active && stock <= 0) {
    issues.push(
      issue({
        key: "active-out-of-stock",
        group: "operation",
        severity: "high",
        label: "Ativo sem estoque",
        message: "Produto ativo sem estoque pode frustrar compra e pagamento."
      })
    );
  }

  if (product.weightGrams === DEFAULT_WEIGHT_GRAMS) {
    issues.push(
      issue({
        key: "default-weight",
        group: "operation",
        severity: "medium",
        label: "Peso padrão",
        message: "150g parece valor inicial; confirme o peso real para frete Anjun."
      })
    );
  }

  if (product.compareAtPriceCents && product.compareAtPriceCents <= product.priceCents) {
    issues.push(
      issue({
        key: "invalid-compare-price",
        group: "promotion",
        severity: "high",
        label: "Desconto inválido",
        message: "Preço comparativo deve ser maior que o preço atual para exibir desconto real."
      })
    );
  }

  const status = statusFromIssues(issues);

  return {
    slug: product.slug,
    name: product.name,
    active: product.active,
    status,
    statusLabel: productQualityStatusLabels[status],
    statusMessage: statusMessage(status),
    issues,
    galleryCount: gallery.length,
    stock,
    hasRealDiscount,
    primaryImage: product.image
  };
}

function countIssues(items: ProductQualityResult[]) {
  const counts = new Map<string, ProductQualityIssue & { count: number }>();

  for (const item of items) {
    for (const issueItem of item.issues) {
      const existing = counts.get(issueItem.key);
      if (existing) existing.count += 1;
      else counts.set(issueItem.key, { ...issueItem, count: 1 });
    }
  }

  const severityRank: Record<ProductQualitySeverity, number> = { high: 0, medium: 1, low: 2 };
  return Array.from(counts.values()).sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity] || b.count - a.count || a.label.localeCompare(b.label)
  );
}

export async function getProductQualityItems() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: { brand: true, category: true, inventory: true },
    orderBy: [{ featuredRank: "asc" }, { updatedAt: "desc" }]
  });

  return products.map(evaluateProductQuality);
}

export async function getProductQualitySummary(): Promise<ProductQualitySummary> {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: { brand: true, category: true, inventory: true },
    orderBy: [{ featuredRank: "asc" }, { updatedAt: "desc" }]
  });
  const items = products.map(evaluateProductQuality);

  return {
    total: items.length,
    readyCount: items.filter((item) => item.status === "READY").length,
    reviewCount: items.filter((item) => item.status === "REVIEW").length,
    actionRequiredCount: items.filter((item) => item.status === "ACTION_REQUIRED").length,
    activeCount: items.filter((item) => item.active).length,
    localUploadCount: items.filter((item) => item.primaryImage.startsWith("/uploads/products/")).length,
    svgDemoCount: items.filter((item) => item.issues.some((issueItem) => issueItem.key === "demo-svg-image")).length,
    defaultWeightCount: items.filter((item) => item.issues.some((issueItem) => issueItem.key === "default-weight")).length,
    wholesaleIssueCount: items.filter((item) => item.issues.some((issueItem) => issueItem.group === "wholesale")).length,
    issueCounts: countIssues(items),
    items
  };
}
