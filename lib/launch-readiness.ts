import type { StoreProfile } from "@/src/generated/prisma/client";
import { getMelhorEnvioConfigStatus } from "@/lib/melhor-envio";
import { buildPaymentConfigDiagnostics } from "@/lib/payment-config-diagnostics";
import type { ProductQualitySummary } from "@/lib/product-quality";

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
  productQuality: ProductQualitySummary;
  policyPageCount: number;
  readinessDoneCount: number;
  readinessTotalCount: number;
  env?: NodeJS.ProcessEnv;
};

const localEmailPattern = /(?:\.local$|@example\.|@test\.|contato@(?:rosagiro|belaviva)\.local$)/i;
const placeholderPhonePattern = /90000|0000-0000|00000000/;
const placeholderAddressPattern = /preparacao|preparação|a ajustar|s\/n|endereco|endereço/i;

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
  const melhorEnvio = getMelhorEnvioConfigStatus(input.env);
  const melhorEnvioProductionReady = melhorEnvio.configured && melhorEnvio.environment === "production";
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
  const hasCatalogDepth = input.productQuality.activeCount > 12;
  const catalogHasActionRequired = input.productQuality.actionRequiredCount > 0 || input.productQuality.activeCount === 0;
  const catalogHasReview = input.productQuality.reviewCount > 0 || !hasCatalogDepth;
  const paymentDiagnostics = buildPaymentConfigDiagnostics(env);
  const hasPixAccount = Boolean(profile?.pixPaymentEnabled && profile.pixKey.trim());
  const hasBusinessPixAccount = Boolean(hasPixAccount && profile?.pixAccountType === "BUSINESS");
  const hasDeployEnvironment =
    hasPublicUrl(env.NEXT_PUBLIC_SITE_URL) && Boolean(env.SESSION_SECRET?.trim()) && Boolean(env.DATABASE_URL?.trim());
  const hasGoogleMaps = Boolean(env.GOOGLE_MAPS_API_KEY?.trim());
  const hasSeoPublicBase = hasPublicUrl(env.NEXT_PUBLIC_SITE_URL);
  const paymentMode = env.PAYMENT_MODE?.trim() || "simulated";
  const livePaymentReady = paymentDiagnostics.status === "READY" && paymentMode === "mercado_pago_live";
  const sandboxPaymentReady = paymentDiagnostics.status === "READY" && paymentMode === "mercado_pago_sandbox";

  const signals = [
    signal({
      key: "store-identity",
      group: "Loja",
      label: "Dados legais e endereço",
      status: profileHasRealIdentity ? "READY" : "ACTION_REQUIRED",
      severity: "high",
      message: profileHasRealIdentity
        ? "CNPJ e endereço parecem substituídos por dados reais."
        : "CNPJ, endereço ou número ainda parecem placeholders; substitua antes da venda real.",
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
      group: "Catálogo",
      label: "Catálogo real",
      status: catalogHasActionRequired ? "ACTION_REQUIRED" : hasCatalogDepth ? "READY" : "WARNING",
      severity: catalogHasActionRequired ? "high" : "medium",
      message: catalogHasActionRequired
        ? `${input.productQuality.actionRequiredCount} produto(s) com lacunas críticas; ${input.productQuality.wholesaleIssueCount} precisam atacado/validade real.`
        : hasCatalogDepth
          ? `${input.productQuality.activeCount} de ${input.productQuality.total} produtos ativos com checks críticos resolvidos.`
          : `${input.productQuality.activeCount} de ${input.productQuality.total} produtos ativos; revise atacado, validade/lote e dados reais de SKU.`,
      actionHref: "/admin/produtos/qualidade"
    }),
    signal({
      key: "catalog-media-weight",
      group: "Catálogo",
      label: "Mídia e peso",
      status: catalogHasActionRequired ? "ACTION_REQUIRED" : catalogHasReview ? "WARNING" : "READY",
      severity: catalogHasActionRequired ? "high" : "medium",
      message: catalogHasActionRequired
        ? `${input.productQuality.actionRequiredCount} produto(s) com lacunas críticas; ${input.productQuality.svgDemoCount} ainda usam SVG de protótipo.`
        : catalogHasReview
          ? `${input.productQuality.reviewCount} produto(s) precisam revisão; ${input.productQuality.defaultWeightCount} estão sem peso conferido.`
          : "Produtos ativos passaram nos checks automáticos de mídia, conteúdo e peso.",
      actionHref: "/admin/produtos/qualidade"
    }),
    signal({
      key: "payment-live",
      group: "Pagamento",
      label: "Mercado Pago live",
      status: livePaymentReady ? "READY" : sandboxPaymentReady ? "WARNING" : "ACTION_REQUIRED",
      severity: "high",
      message:
        livePaymentReady
          ? "Live, token, webhook secret e URL pública parecem configurados para pagamento real."
          : sandboxPaymentReady
            ? "Sandbox está pronto; troque para live e valide pagamento real antes de vender."
          : paymentDiagnostics.fallbackMessage,
      actionHref: "/admin/pagamentos"
    }),
    signal({
      key: "payment-pix-account",
      group: "Pagamento",
      label: "Conta Pix de recebimento",
      status: hasBusinessPixAccount ? "READY" : hasPixAccount ? "WARNING" : "ACTION_REQUIRED",
      severity: hasBusinessPixAccount ? "medium" : "high",
      message: hasBusinessPixAccount
        ? "Pix empresarial/PJ configurado nos dados da loja."
        : hasPixAccount
          ? "Pix pessoal temporário configurado; use para soft launch e troque para conta PJ antes de escalar vendas."
          : "Nenhuma conta Pix ativa cadastrada; configure em Loja / Confiança para receber manualmente.",
      actionHref: "/admin/loja"
    }),
    signal({
      key: "shipping-rates",
      group: "Logística",
      label: "Melhor Envio",
      status: melhorEnvioProductionReady ? "READY" : melhorEnvio.tokenConfigured ? "WARNING" : "ACTION_REQUIRED",
      severity: "high",
      message:
        melhorEnvioProductionReady
          ? "Cotação de produção configurada para calcular transportadoras por CEP antes do pagamento."
          : melhorEnvio.tokenConfigured
            ? "A integração possui token, mas ainda não está marcada como ambiente de produção."
            : "Token da Melhor Envio ausente; entregas não podem ser finalizadas sem uma cotação válida.",
      actionHref: "/admin/frete"
    }),
    signal({
      key: "address-validation",
      group: "Endereço",
      label: "Endereço e CEP",
      status: hasGoogleMaps ? "READY" : "WARNING",
      severity: "medium",
      message: hasGoogleMaps
        ? "Google Maps key existe para validação opcional; ViaCEP continua como fallback."
        : "Google Maps está desativado; checkout usa ViaCEP e preenchimento manual.",
      actionHref: "/admin/prontidao"
    }),
    signal({
      key: "deploy-env",
      group: "Deploy",
      label: "Ambiente público",
      status: hasDeployEnvironment ? "READY" : "ACTION_REQUIRED",
      severity: "high",
      message: hasDeployEnvironment
        ? "URL pública, session secret e database url existem no ambiente atual."
        : "Ambiente atual ainda parece local ou incompleto para venda real.",
      actionHref: "/admin/prontidao"
    }),
    signal({
      key: "policies-seo",
      group: "Operação",
      label: "Políticas e SEO",
      status: input.policyPageCount >= 6 ? "WARNING" : "ACTION_REQUIRED",
      severity: "medium",
      message:
        input.policyPageCount >= 6
          ? "Páginas básicas existem, mas ainda precisam revisão jurídica/operacional real."
          : "Políticas, SEO ou páginas públicas básicas ainda estão incompletas.",
      actionHref: "/admin/prontidao"
    }),
    signal({
      key: "seo-baseline",
      group: "Operação",
      label: "SEO/GEO baseline",
      status: hasSeoPublicBase && input.policyPageCount >= 6 ? "WARNING" : "ACTION_REQUIRED",
      severity: "medium",
      message:
        hasSeoPublicBase && input.policyPageCount >= 6
          ? "Metadata, sitemap, robots e llms.txt podem ser auditados no domínio público; rode SEO audit antes do go-live."
          : "Configure NEXT_PUBLIC_SITE_URL com HTTPS público e revise páginas públicas antes do audit SEO final.",
      actionHref: "/admin/prontidao"
    }),
    signal({
      key: "manual-readiness",
      group: "Operação",
      label: "Checklist manual",
      status: input.readinessTotalCount && input.readinessDoneCount === input.readinessTotalCount ? "READY" : "WARNING",
      severity: "medium",
      message: `${input.readinessDoneCount} de ${input.readinessTotalCount} itens manuais marcados como concluídos.`,
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
  ACTION_REQUIRED: "Ação necessária"
};

export async function getLaunchReadinessSnapshot() {
  const { prisma } = await import("@/lib/db");
  const { getProductQualitySummary } = await import("@/lib/product-quality");
  const [
    profile,
    productQuality,
    policyPageCount,
    readinessDoneCount,
    readinessTotalCount
  ] = await Promise.all([
    prisma.storeProfile.findUnique({ where: { id: "main" } }),
    getProductQualitySummary(),
    prisma.siteInfoPage.count({ where: { active: true } }),
    prisma.launchReadinessItem.count({ where: { status: "DONE" } }),
    prisma.launchReadinessItem.count()
  ]);

  return buildLaunchReadinessSnapshot({
    profile,
    productQuality,
    policyPageCount: policyPageCount + 1,
    readinessDoneCount,
    readinessTotalCount
  });
}
