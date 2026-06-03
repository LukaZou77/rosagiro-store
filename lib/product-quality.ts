import "server-only";

import type { Prisma } from "@/src/generated/prisma/client";
import { prisma } from "@/lib/db";
import { normalizeProductGallery } from "@/lib/product-import-shared";

export type ProductQualityStatus = "READY" | "REVIEW" | "ACTION_REQUIRED";
export type ProductQualitySeverity = "low" | "medium" | "high";
export type ProductQualityGroup = "media" | "content" | "operation" | "promotion" | "launch";

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
  issueCounts: Array<ProductQualityIssue & { count: number }>;
  items: ProductQualityResult[];
};

export type ProductWithQualityRelations = Prisma.ProductGetPayload<{
  include: { brand: true; category: true; inventory: true };
}>;

export const productQualityStatusLabels: Record<ProductQualityStatus, string> = {
  READY: "Pronto",
  REVIEW: "Revisar",
  ACTION_REQUIRED: "Acao necessaria"
};

export const productQualityGroupLabels: Record<ProductQualityGroup, string> = {
  media: "Midia",
  content: "Conteudo",
  operation: "Operacao",
  promotion: "Promocao",
  launch: "Publicacao"
};

const PLACEHOLDER_PATTERN = /placeholder/i;
const ADJUST_PATTERN = /a ajustar|exemplo|preparacao|prepara\u00e7\u00e3o|teste|demo/i;
const MIN_DESCRIPTION_LENGTH = 80;
const MIN_GALLERY_IMAGES = 3;
const DEFAULT_WEIGHT_GRAMS = 150;

function textLooksDraft(value: string | null | undefined) {
  return !value?.trim() || ADJUST_PATTERN.test(value);
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
  if (status === "READY") return "Ficha pronta para revisao final de venda.";
  if (status === "ACTION_REQUIRED") return "Precisa corrigir itens importantes antes de vender.";
  return "Boa base, mas ainda precisa conferencias operacionais.";
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
        label: "Imagem de demonstracao",
        message: "A vitrine ainda usa SVG de prototipo; envie fotos reais antes da venda."
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
        message: "Upload local funciona no desenvolvimento, mas precisa migrar para storage persistente na producao."
      })
    );
  }

  if (product.descriptionPt.trim().length < MIN_DESCRIPTION_LENGTH || textLooksDraft(product.descriptionPt)) {
    issues.push(
      issue({
        key: "weak-description",
        group: "content",
        severity: "medium",
        label: "Descricao incompleta",
        message: "Inclua descricao comercial clara, uso, beneficio e contexto de compra no atacado."
      })
    );
  }

  if (listLooksDraft(product.benefits, 2)) {
    issues.push(
      issue({
        key: "missing-benefits",
        group: "content",
        severity: "medium",
        label: "Beneficios a revisar",
        message: "Preencha pelo menos dois beneficios reais separados para a vitrine."
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
        message: "Informe composicao, ativo principal ou material para reduzir duvidas no WhatsApp."
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
        message: "Complete origem e descricao da marca para melhorar confianca e filtros."
      })
    );
  }

  if (textLooksDraft(product.category.note)) {
    issues.push(
      issue({
        key: "category-data-draft",
        group: "content",
        severity: "low",
        label: "Categoria sem descricao",
        message: "Complete a nota da categoria para orientar compra por prateleira."
      })
    );
  }

  if (product.priceCents <= 0) {
    issues.push(
      issue({
        key: "invalid-price",
        group: "operation",
        severity: "high",
        label: "Preco invalido",
        message: "Produto precisa de preco maior que zero para checkout."
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
        label: "Peso padrao",
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
        label: "Desconto invalido",
        message: "Preco comparativo deve ser maior que o preco atual para exibir desconto real."
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
    include: { brand: true, category: true, inventory: true },
    orderBy: [{ featuredRank: "asc" }, { updatedAt: "desc" }]
  });

  return products.map(evaluateProductQuality);
}

export async function getProductQualitySummary(): Promise<ProductQualitySummary> {
  const products = await prisma.product.findMany({
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
    issueCounts: countIssues(items),
    items
  };
}
