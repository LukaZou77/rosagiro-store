import type { StoreProfile } from "@/src/generated/prisma/client";
import { allInfoPages } from "@/lib/site-config";

export type LaunchReadinessSignalStatus = "READY" | "WARNING" | "ACTION_REQUIRED";
export type LaunchReadinessSignalSeverity = "low" | "medium" | "high";

export type LaunchReadinessSignal = {
  key: string;
  group: string;
  label: string;
  status: LaunchReadinessSignalStatus;
  severity: LaunchReadinessSignalSeverity;
  message: string;
  actionHref: string;
};

export type LaunchReadinessSnapshot = {
  signals: LaunchReadinessSignal[];
  readyCount: number;
  warningCount: number;
  actionRequiredCount: number;
  highPriorityIssues: LaunchReadinessSignal[];
};

type BuildSnapshotInput = {
  profile: StoreProfile | null;
  productCount: number;
  activeProductCount: number;
  placeholderImageCount: number;
  productsWithoutWeightCount: number;
  activeShippingImportCount: number;
  policyPageCount: number;
  readinessDoneCount: number;
  readinessTotalCount: number;
  env?: NodeJS.ProcessEnv;
};

const localEmailPattern = /(?:\.local$|@example\.|@test\.|contato@belaviva\.local$)/i;
const placeholderPhonePattern = /90000|0000-0000|00000000/;
const placeholderAddressPattern = /preparacao|a ajustar|s\/n|endereco/i;

function onlyDigits(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

function hasRealCnpj(value?: string | null) {
  const digits = onlyDigits(value);
  return digits.length === 14 && !/^0+$/.test(digits);
}

function hasPublicUrl(value?: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}

function signal(input: LaunchReadinessSignal): LaunchReadinessSignal {
  return input;
}

export function buildLaunchReadinessSnapshot(input: BuildSnapshotInput): LaunchReadinessSnapshot {
  const env = input.env || process.env;
  const profile = input.profile;
  const profileHasRealIdentity = Boolean(profile && hasRealCnpj(profile.cnpj) && !placeholderAddressPattern.test(profile.street));
  const profileHasRealChannels = Boolean(
    profile &&
      !localEmailPattern.test(profile.email) &&
      onlyDigits(profile.whatsapp).length >= 10 &&
      !placeholderPhonePattern.test(profile.whatsapp)
  );
  const hasSocialLink = Boolean(profile?.instagramUrl || profile?.facebookUrl || profile?.tiktokUrl);
  const hasCatalogDepth = input.activeProductCount > 12;
  const hasUsableCatalog = input.activeProductCount > 0 && input.placeholderImageCount === 0 && input.productsWithoutWeightCount === 0;
  const paymentMode = (env.PAYMENT_MODE || "").trim();
  const hasMercadoPagoSandbox =
    paymentMode === "mercado_pago_sandbox" &&
    Boolean(env.MERCADO_PAGO_ACCESS_TOKEN?.trim()) &&
    Boolean(env.MERCADO_PAGO_WEBHOOK_SECRET?.trim()) &&
    hasPublicUrl(env.NEXT_PUBLIC_SITE_URL);
  const hasDeployEnvironment =
    hasPublicUrl(env.NEXT_PUBLIC_SITE_URL) && Boolean(env.SESSION_SECRET?.trim()) && Boolean(env.DATABASE_URL?.trim());
  const hasGoogleMaps = Boolean(env.GOOGLE_MAPS_API_KEY?.trim());

  const signals = [
    signal({
      key: "store-identity",
      group: "Loja",
      label: "Dados legais e endereco",
      status: profileHasRealIdentity ? "READY" : "ACTION_REQUIRED",
      severity: "high",
      message: profileHasRealIdentity
        ? "CNPJ e endereco parecem substituidos por dados reais."
        : "CNPJ, endereco ou numero ainda parecem placeholders; substitua antes da venda real.",
      actionHref: "/admin/loja"
    }),
    signal({
      key: "store-channels",
      group: "Loja",
      label: "Canais comerciais",
      status: profileHasRealChannels ? (hasSocialLink ? "READY" : "WARNING") : "ACTION_REQUIRED",
      severity: profileHasRealChannels ? "medium" : "high",
      message: profileHasRealChannels
        ? hasSocialLink
          ? "WhatsApp, e-mail e ao menos uma rede social parecem configurados."
          : "WhatsApp e e-mail parecem reais; redes sociais ainda podem ser adicionadas."
        : "WhatsApp ou e-mail ainda parecem canais de teste.",
      actionHref: "/admin/loja"
    }),
    signal({
      key: "catalog-real-data",
      group: "Catalogo",
      label: "Catalogo real",
      status: hasCatalogDepth ? "READY" : hasUsableCatalog ? "WARNING" : "ACTION_REQUIRED",
      severity: hasCatalogDepth ? "medium" : "high",
      message: hasCatalogDepth
        ? `${input.activeProductCount} de ${input.productCount} produtos ativos com dados operacionais.`
        : `${input.activeProductCount} de ${input.productCount} produtos ativos; ainda parece catalogo piloto de 12 SKUs.`,
      actionHref: "/admin/produtos"
    }),
    signal({
      key: "catalog-media-weight",
      group: "Catalogo",
      label: "Midia e peso",
      status: input.placeholderImageCount === 0 && input.productsWithoutWeightCount === 0 ? "READY" : "ACTION_REQUIRED",
      severity: "medium",
      message:
        input.placeholderImageCount === 0 && input.productsWithoutWeightCount === 0
          ? "Produtos ativos nao usam imagem vazia/placeholder e possuem peso para frete."
          : `${input.placeholderImageCount} imagens placeholder/vazias e ${input.productsWithoutWeightCount} produtos sem peso.`,
      actionHref: "/admin/importar-produtos"
    }),
    signal({
      key: "payment-sandbox",
      group: "Pagamento",
      label: "Mercado Pago sandbox",
      status: hasMercadoPagoSandbox ? "READY" : "ACTION_REQUIRED",
      severity: "high",
      message: hasMercadoPagoSandbox
        ? "Modo sandbox, token, webhook secret e URL publica parecem configurados."
        : "Sandbox ainda depende de PAYMENT_MODE, token, webhook secret e URL HTTPS publica.",
      actionHref: "/admin/prontidao"
    }),
    signal({
      key: "shipping-rates",
      group: "Logistica",
      label: "Tabela Anjun ativa",
      status: input.activeShippingImportCount > 0 ? "READY" : "ACTION_REQUIRED",
      severity: "high",
      message:
        input.activeShippingImportCount > 0
          ? "Existe tabela Anjun ativa para estimar frete por CEP e peso."
          : "Nenhuma tabela Anjun ativa; checkout ficara limitado a retirada/consulta manual.",
      actionHref: "/admin/frete"
    }),
    signal({
      key: "address-validation",
      group: "Endereco",
      label: "Endereco e CEP",
      status: hasGoogleMaps ? "READY" : "WARNING",
      severity: "medium",
      message: hasGoogleMaps
        ? "Google Maps key existe para validacao opcional; ViaCEP continua como fallback."
        : "Google Maps esta desativado; checkout usa ViaCEP e preenchimento manual.",
      actionHref: "/admin/prontidao"
    }),
    signal({
      key: "deploy-env",
      group: "Deploy",
      label: "Ambiente publico",
      status: hasDeployEnvironment ? "READY" : "ACTION_REQUIRED",
      severity: "high",
      message: hasDeployEnvironment
        ? "URL publica, session secret e database url existem no ambiente atual."
        : "Ambiente atual ainda parece local ou incompleto para venda real.",
      actionHref: "/admin/prontidao"
    }),
    signal({
      key: "policies-seo",
      group: "Operacao",
      label: "Politicas e SEO",
      status: input.policyPageCount >= 6 ? "WARNING" : "ACTION_REQUIRED",
      severity: "medium",
      message:
        input.policyPageCount >= 6
          ? "Paginas basicas existem, mas ainda precisam revisao juridica/operacional real."
          : "Politicas, SEO ou paginas publicas basicas ainda estao incompletas.",
      actionHref: "/admin/prontidao"
    }),
    signal({
      key: "manual-readiness",
      group: "Operacao",
      label: "Checklist manual",
      status: input.readinessTotalCount && input.readinessDoneCount === input.readinessTotalCount ? "READY" : "WARNING",
      severity: "medium",
      message: `${input.readinessDoneCount} de ${input.readinessTotalCount} itens manuais marcados como concluidos.`,
      actionHref: "/admin/prontidao"
    })
  ];

  const readyCount = signals.filter((item) => item.status === "READY").length;
  const warningCount = signals.filter((item) => item.status === "WARNING").length;
  const actionRequiredCount = signals.filter((item) => item.status === "ACTION_REQUIRED").length;
  const highPriorityIssues = signals.filter((item) => item.status !== "READY" && item.severity === "high");

  return {
    signals,
    readyCount,
    warningCount,
    actionRequiredCount,
    highPriorityIssues
  };
}

export const launchReadinessSignalLabels: Record<LaunchReadinessSignalStatus, string> = {
  READY: "Pronto",
  WARNING: "Revisar",
  ACTION_REQUIRED: "Acao necessaria"
};

export async function getLaunchReadinessSnapshot() {
  const { prisma } = await import("@/lib/db");
  const [
    profile,
    productCount,
    activeProductCount,
    placeholderImageCount,
    productsWithoutWeightCount,
    activeShippingImportCount,
    readinessDoneCount,
    readinessTotalCount
  ] = await Promise.all([
    prisma.storeProfile.findUnique({ where: { id: "main" } }),
    prisma.product.count(),
    prisma.product.count({ where: { active: true } }),
    prisma.product.count({ where: { OR: [{ image: { contains: "placeholder" } }, { image: { equals: "" } }] } }),
    prisma.product.count({ where: { weightGrams: { lte: 0 } } }),
    prisma.shippingRateImport.count({ where: { active: true } }),
    prisma.launchReadinessItem.count({ where: { status: "DONE" } }),
    prisma.launchReadinessItem.count()
  ]);

  return buildLaunchReadinessSnapshot({
    profile,
    productCount,
    activeProductCount,
    placeholderImageCount,
    productsWithoutWeightCount,
    activeShippingImportCount,
    policyPageCount: allInfoPages.length + 1,
    readinessDoneCount,
    readinessTotalCount
  });
}
