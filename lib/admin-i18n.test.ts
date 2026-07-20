import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_LOCALE_COOKIE,
  adminLocaleLabel,
  createAdminTranslator,
  normalizeAdminLocale
} from "@/lib/admin-i18n";
import {
  adminPaymentStatusLabel,
  localizeLaunchSignal,
  localizePaymentCheck,
  localizeReadinessItem
} from "@/lib/admin-i18n-content";
import { formatAdminDateTime } from "@/lib/date-format";

test("normaliza o idioma do painel sem aceitar valores arbitrarios", () => {
  assert.equal(normalizeAdminLocale("zh-CN"), "zh-CN");
  assert.equal(normalizeAdminLocale("pt-BR"), "pt-BR");
  assert.equal(normalizeAdminLocale("en-US"), "pt-BR");
  assert.equal(normalizeAdminLocale(undefined), "pt-BR");
});

test("traduz apenas a interface administrativa selecionada", () => {
  assert.equal(createAdminTranslator("pt-BR")("Pedidos", "订单"), "Pedidos");
  assert.equal(createAdminTranslator("zh-CN")("Pedidos", "订单"), "订单");
  assert.equal(adminLocaleLabel("pt-BR"), "PT-BR");
  assert.equal(adminLocaleLabel("zh-CN"), "中文");
  assert.equal(ADMIN_LOCALE_COOKIE, "rosagiro_admin_locale");
});

test("traduz estados dinamicos do painel sem alterar a versao em portugues", () => {
  const signal = {
    key: "shipping-rates",
    group: "Logística",
    label: "Melhor Envio",
    status: "READY",
    severity: "high",
    message: "Cotação de produção configurada para calcular transportadoras por CEP antes do pagamento.",
    actionHref: "/admin/frete"
  };
  assert.equal(localizeLaunchSignal(signal, "pt-BR"), signal);
  assert.equal(localizeLaunchSignal(signal, "zh-CN").label, "Melhor Envio 实时运费");
  assert.equal(adminPaymentStatusLabel("WARNING", "simulated", "zh-CN"), "当前为模拟模式");
});

test("traduz diagnostico e checklist administrativo por chaves estaveis", () => {
  const check = {
    key: "access-token",
    label: "Access token Mercado Pago",
    status: "READY",
    severity: "high",
    message: "Token existe no ambiente atual; valor não é exibido."
  };
  assert.equal(localizePaymentCheck(check, "mercado_pago_live", "zh-CN").label, "Mercado Pago 访问令牌");
  const item = {
    itemKey: "store-legal-identity",
    group: "Loja",
    title: "Dados legais da loja",
    description: "Descrição original"
  };
  assert.equal(localizeReadinessItem(item, "zh-CN").title, "店铺法定资料");
  assert.equal(localizeReadinessItem(item, "pt-BR"), item);
});

test("formata datas no idioma escolhido mantendo o fuso de Sao Paulo", () => {
  const date = new Date("2026-07-12T03:00:00.000Z");
  const portuguese = formatAdminDateTime(date, "Sem registro", "pt-BR");
  const chinese = formatAdminDateTime(date, "未记录", "zh-CN");
  assert.match(portuguese, /2026/);
  assert.match(chinese, /2026/);
  assert.notEqual(portuguese, chinese);
});
