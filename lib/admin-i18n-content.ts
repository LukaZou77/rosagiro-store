import type { AdminLocale } from "@/lib/admin-i18n";

type StatusText = {
  key: string;
  status: string;
  label: string;
  message: string;
};

type PaymentCheck = StatusText & {
  severity?: string;
};

const launchLabelsZh: Record<string, string> = {
  "store-identity": "法定资料与地址",
  "store-channels": "销售联系渠道",
  "catalog-real-data": "真实商品目录",
  "catalog-media-weight": "图片与重量",
  "payment-live": "Mercado Pago 正式付款",
  "payment-pix-account": "Pix 收款账户",
  "shipping-rates": "Melhor Envio 实时运费",
  "address-validation": "地址与邮编",
  "deploy-env": "生产环境",
  "policies-seo": "政策与 SEO",
  "seo-baseline": "SEO / GEO 基础",
  "manual-readiness": "人工检查清单"
};

const launchGroupsZh: Record<string, string> = {
  Loja: "店铺",
  "Catálogo": "商品目录",
  Pagamento: "支付",
  "Logística": "物流",
  "Endereço": "地址",
  Deploy: "部署",
  "Operação": "运营"
};

function numbersFrom(value: string) {
  return value.match(/\d+/g) || [];
}

function launchMessageZh(signal: StatusText) {
  const numbers = numbersFrom(signal.message);
  switch (signal.key) {
    case "store-identity":
      return signal.status === "READY"
        ? "CNPJ 和地址已使用真实资料。"
        : "CNPJ、地址或门牌号仍像占位资料，正式销售前必须替换。";
    case "store-channels":
      if (signal.status === "READY") return "WhatsApp、电子邮箱和至少一个社交平台已配置。";
      if (signal.status === "WARNING") return "WhatsApp 和电子邮箱已配置，仍可补充社交平台。";
      return "WhatsApp 或电子邮箱仍像测试渠道。";
    case "catalog-real-data":
      if (signal.status === "ACTION_REQUIRED") {
        return `${numbers[0] || 0} 个商品存在关键资料缺口；${numbers[1] || 0} 个商品需要补充真实批发或保质期资料。`;
      }
      return `${numbers[0] || 0}/${numbers[1] || 0} 个商品已启用；请持续核对批发、保质期、批次及真实 SKU 资料。`;
    case "catalog-media-weight":
      if (signal.status === "ACTION_REQUIRED") {
        return `${numbers[0] || 0} 个商品存在关键资料缺口；${numbers[1] || 0} 个商品仍使用原型 SVG 图片。`;
      }
      if (signal.status === "WARNING") {
        return `${numbers[0] || 0} 个商品需要复核；${numbers[1] || 0} 个商品尚未确认重量。`;
      }
      return "已启用商品通过图片、内容和重量自动检查。";
    case "payment-live":
      if (signal.status === "READY") return "正式模式、令牌、Webhook 密钥和公开 URL 均已配置。";
      if (signal.status === "WARNING") return "沙盒环境已就绪；正式销售前请切换正式模式并完成真实付款验证。";
      return "Mercado Pago 正式付款配置尚未完成，请打开支付诊断查看阻塞项。";
    case "payment-pix-account":
      if (signal.status === "READY") return "店铺资料中已配置企业 Pix 收款账户。";
      if (signal.status === "WARNING") return "当前使用个人 Pix 临时收款，扩大销售前应更换企业账户。";
      return "尚未配置可用 Pix 收款账户，请在店铺资料中完成设置。";
    case "shipping-rates":
      if (signal.status === "READY") return "Melhor Envio 正式报价已启用，可在付款前按邮编计算运费。";
      if (signal.status === "WARNING") return "Melhor Envio 已有令牌，但尚未切换到正式环境。";
      return "尚未配置 Melhor Envio 令牌；没有有效报价时，配送订单不能进入付款。";
    case "address-validation":
      return signal.status === "READY"
        ? "已配置 Google Maps，可辅助验证地址；ViaCEP 继续作为备用。"
        : "Google Maps 未启用，结账使用 ViaCEP 和手动填写。";
    case "deploy-env":
      return signal.status === "READY"
        ? "当前环境已配置公开 URL、会话密钥和数据库连接。"
        : "当前环境仍像本地或缺少正式销售所需配置。";
    case "policies-seo":
      return signal.status === "WARNING"
        ? "基础政策页面已存在，但仍需结合真实运营和法律要求复核。"
        : "政策、SEO 或基础公开页面尚未完整。";
    case "seo-baseline":
      return signal.status === "WARNING"
        ? "可在正式域名审查 metadata、sitemap、robots 和 llms.txt；上线前请再执行 SEO 审查。"
        : "请配置公开 HTTPS 站点地址，并在最终 SEO 审查前复核公开页面。";
    case "manual-readiness":
      return `${numbers[0] || 0}/${numbers[1] || 0} 个人工检查项已标记完成。`;
    default:
      return signal.message;
  }
}

export function localizeLaunchSignal<T extends StatusText>(signal: T, locale: AdminLocale): T {
  if (locale !== "zh-CN") return signal;
  return {
    ...signal,
    label: launchLabelsZh[signal.key] || signal.label,
    message: launchMessageZh(signal)
  };
}

export function adminLaunchStatusLabel(status: string, locale: AdminLocale) {
  if (locale !== "zh-CN") {
    if (status === "READY") return "Pronto";
    if (status === "WARNING") return "Revisar";
    return "Ação necessária";
  }
  if (status === "READY") return "正常";
  if (status === "WARNING") return "需要复核";
  return "必须处理";
}

export function adminLaunchGroupLabel(group: string, locale: AdminLocale) {
  return locale === "zh-CN" ? launchGroupsZh[group] || group : group;
}

const paymentCheckLabelsZh: Record<string, string> = {
  "payment-mode": "付款模式",
  "access-token": "Mercado Pago 访问令牌",
  "webhook-secret": "Webhook 密钥",
  "public-url": "公开 HTTPS URL"
};

function paymentCheckMessageZh(check: PaymentCheck, mode: string) {
  switch (check.key) {
    case "payment-mode":
      if (mode === "mercado_pago_live") return "PAYMENT_MODE 已设为正式付款模式。";
      if (mode === "mercado_pago_sandbox") return "PAYMENT_MODE 已设为沙盒测试模式。";
      if (mode === "simulated") return "PAYMENT_MODE 当前为模拟模式，Pix 和银行卡使用本地流程。";
      return "PAYMENT_MODE 的值无法被系统识别。";
    case "access-token":
      if (check.status === "READY") return "当前环境已配置令牌，具体值不会显示。";
      if (check.status === "ACTION_REQUIRED") return "尚未配置 MERCADO_PAGO_ACCESS_TOKEN。";
      return "模拟付款模式不需要访问令牌。";
    case "webhook-secret":
      if (check.status === "READY") return "已配置用于校验 x-signature 的密钥，具体值不会显示。";
      if (check.status === "ACTION_REQUIRED") return "处理 Webhook 前必须配置 MERCADO_PAGO_WEBHOOK_SECRET。";
      return "模拟付款模式不需要 Webhook 密钥。";
    case "public-url":
      if (check.status === "READY") return "NEXT_PUBLIC_SITE_URL 是公开地址，Mercado Pago 可以访问 Webhook。";
      if (check.status === "ACTION_REQUIRED") return "NEXT_PUBLIC_SITE_URL 仍为空、本地地址或未使用公开 HTTPS。";
      return "模拟付款模式下公开 URL 不是必需项。";
    default:
      return check.message;
  }
}

export function localizePaymentCheck<T extends PaymentCheck>(check: T, mode: string, locale: AdminLocale): T {
  if (locale !== "zh-CN") return check;
  return {
    ...check,
    label: paymentCheckLabelsZh[check.key] || check.label,
    message: paymentCheckMessageZh(check, mode)
  };
}

export function adminPaymentModeLabel(mode: string, locale: AdminLocale) {
  if (locale !== "zh-CN") return mode;
  if (mode === "mercado_pago_live") return "正式模式";
  if (mode === "mercado_pago_sandbox") return "沙盒模式";
  return "模拟模式";
}

export function adminPaymentStatusLabel(status: string, mode: string, locale: AdminLocale) {
  if (locale !== "zh-CN") {
    if (status === "READY") return mode === "mercado_pago_live" ? "Live pronto" : "Sandbox pronto";
    if (status === "WARNING") return mode === "simulated" ? "Modo simulado" : "Revisar configuração";
    return "Ação necessária";
  }
  if (status === "READY") return mode === "mercado_pago_live" ? "正式付款已就绪" : "沙盒环境已就绪";
  if (status === "WARNING") return mode === "simulated" ? "当前为模拟模式" : "需要复核配置";
  return "必须完成配置";
}

export function adminPaymentFallbackMessage(
  status: string,
  mode: string,
  checks: PaymentCheck[],
  fallback: string,
  locale: AdminLocale
) {
  if (locale !== "zh-CN") return fallback;
  if (mode === "simulated") return "结账当前为模拟模式，Pix 和银行卡不会在此环境打开 Mercado Pago。";
  const blockers = checks.filter((item) => item.status === "ACTION_REQUIRED");
  if (blockers.length) {
    return `完成以下项目后才能使用 Mercado Pago：${blockers.map((item) => paymentCheckLabelsZh[item.key] || item.label).join("、")}。`;
  }
  if (status === "READY") {
    return mode === "mercado_pago_live"
      ? "客户提交订单时，Pix 和银行卡可以打开 Mercado Pago 正式 Checkout Pro。"
      : "客户提交订单时，Pix 和银行卡可以打开 Mercado Pago 沙盒 Checkout Pro。";
  }
  return "请复核 Mercado Pago 配置后再启用付款。";
}

export function adminPaymentMethodLabel(method: string, locale: AdminLocale) {
  if (locale !== "zh-CN") return method === "CREDIT_CARD" ? "Cartão de crédito" : method === "PIX" ? "Pix" : "Confirmar com atendimento";
  if (method === "CREDIT_CARD") return "银行卡";
  if (method === "PIX") return "Pix";
  return "人工确认";
}

export function adminPaymentProviderLabel(provider: string, locale: AdminLocale) {
  if (provider === "MERCADO_PAGO") return "Mercado Pago";
  return locale === "zh-CN" ? "人工客服" : "Atendimento";
}

export function adminPaymentRecordStatusLabel(status: string, locale: AdminLocale) {
  if (locale !== "zh-CN") {
    if (status === "PAID") return "Pago";
    if (status === "FAILED") return "Falhou";
    return "Aguardando pagamento";
  }
  if (status === "PAID") return "已付款";
  if (status === "FAILED") return "付款失败";
  return "等待付款";
}

const qualityStatusZh: Record<string, string> = {
  READY: "可销售",
  REVIEW: "需要复核",
  ACTION_REQUIRED: "必须处理"
};

const qualityGroupsZh: Record<string, string> = {
  media: "图片",
  content: "内容",
  wholesale: "批发资料",
  operation: "运营",
  launch: "发布"
};

export const adminQualityIssueLabelsZh: Record<string, string> = {
  "missing-primary-image": "缺少主图",
  "demo-svg-image": "仍在使用示意图",
  "gallery-too-small": "图库图片不足",
  "local-upload-storage": "本地图片需迁移",
  "weak-description": "商品描述不完整",
  "brand-data-draft": "品牌资料不完整",
  "category-data-draft": "品类描述不完整",
  "missing-wholesale-package": "缺少真实批发包装规则",
  "missing-validity-note": "保质期或批次待确认",
  "missing-purchase-note": "缺少采购备注",
  "invalid-price": "价格无效",
  "active-out-of-stock": "启用商品处于缺货状态",
  "missing-weight": "未填写重量"
};

export function adminQualityStatusLabel(status: string, fallback: string, locale: AdminLocale) {
  return locale === "zh-CN" ? qualityStatusZh[status] || fallback : fallback;
}

export function adminQualityStatusMessage(status: string, fallback: string, locale: AdminLocale) {
  if (locale !== "zh-CN") return fallback;
  if (status === "READY") return "自动检查未发现影响销售的问题。";
  if (status === "REVIEW") return "请复核提示项目，确认资料真实完整。";
  return "该商品存在影响正常销售的资料缺口，请先处理。";
}

export function adminQualityGroupLabel(group: string, fallback: string, locale: AdminLocale) {
  return locale === "zh-CN" ? qualityGroupsZh[group] || fallback : fallback;
}

export function adminQualityIssueLabel(key: string, fallback: string, locale: AdminLocale) {
  return locale === "zh-CN" ? adminQualityIssueLabelsZh[key] || fallback : fallback;
}

const readinessItemsZh: Record<string, { group: string; title: string; description: string }> = {
  "store-legal-identity": { group: "店铺", title: "店铺法定资料", description: "填写真实 CNPJ、州税号、公司名称、营业地址和客服时间。" },
  "store-support-channels": { group: "店铺", title: "真实客服渠道", description: "正式发布前，将 WhatsApp、电子邮箱和社交平台替换为真实销售渠道。" },
  "catalog-real-products": { group: "商品目录", title: "真实商品目录", description: "导入真实 SKU、品牌、分类、价格、描述、图片、库存、重量、保质期或批次及批发资料。" },
  "catalog-media-quality": { group: "商品目录", title: "商品图片与媒体", description: "确认最终商品图、视觉规范、外部链接和占位图，并在部署前把本地图片迁移到持久存储。" },
  "payment-mercado-pago-sandbox": { group: "支付", title: "Mercado Pago 沙盒验证", description: "配置测试账户、沙盒访问令牌和 Webhook 密钥，并通过 HTTPS 验证 Checkout Pro。" },
  "payment-live-cutover": { group: "支付", title: "切换真实付款", description: "正式收费前复核正式凭证、公开 Webhook、到账金额、库存、拒付、退款和监控。" },
  "shipping-melhor-envio": { group: "物流", title: "Melhor Envio 与运费规则", description: "确认正式令牌、发货邮编、商品重量、技术包装参数和结账报价。" },
  "shipping-manual-fees": { group: "物流", title: "费用与人工复核", description: "明确保险、税费、风险地区、偏远地区、承运商和例外情况的处理方式。" },
  "address-google-maps": { group: "地址", title: "可选 Google Maps", description: "如启用 Google 地址验证，请配置受限 API 密钥，并检查自动补全、详情和地址验证。" },
  "address-manual-review": { group: "地址", title: "地址人工复核", description: "制定 ViaCEP 资料不完整、Google 未启用或需要复核地址的处理流程。" },
  "deploy-vercel-env": { group: "部署", title: "Vercel 环境与变量", description: "在正确环境配置域名、站点 URL、生产数据库、会话密钥、Mercado Pago 和 Google。" },
  "deploy-production-db": { group: "部署", title: "生产数据库", description: "发布前执行迁移、受控种子数据、真实数据导入及备份和回滚验证。" },
  "ops-policies-lgpd": { group: "运营", title: "政策与 LGPD", description: "复核条款、隐私、换货、退货、配送、客服、个人数据和美妆商品规则。" },
  "ops-seo-merchant": { group: "运营", title: "SEO 与销售渠道", description: "推广前检查 metadata、sitemap、robots、Open Graph、Google Merchant 商品源及结构化数据。" }
};

export function localizeReadinessItem<T extends { itemKey: string; group: string; title: string; description: string }>(item: T, locale: AdminLocale): T {
  const translated = locale === "zh-CN" ? readinessItemsZh[item.itemKey] : null;
  return translated ? { ...item, ...translated } : item;
}
