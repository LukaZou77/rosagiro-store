import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { createAdminTranslator } from "@/lib/admin-i18n";
import {
  adminPaymentFallbackMessage,
  adminPaymentMethodLabel,
  adminPaymentModeLabel,
  adminPaymentProviderLabel,
  adminPaymentRecordStatusLabel,
  adminPaymentStatusLabel,
  localizePaymentCheck
} from "@/lib/admin-i18n-content";
import { getAdminLocale } from "@/lib/admin-i18n-server";
import { formatAdminDateTime } from "@/lib/date-format";
import { money } from "@/lib/money";
import { getPaymentDiagnosticSnapshot, type PaymentDiagnosticStatus } from "@/lib/payment-diagnostics";

function statusClass(status: PaymentDiagnosticStatus) {
  return status.toLowerCase().replace("_", "-");
}

function shortValue(value: string | null, emptyLabel = "Não registrado") {
  if (!value) return emptyLabel;
  if (value.length <= 22) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

export default async function AdminPaymentsPage() {
  const [admin, snapshot, locale] = await Promise.all([requireAdmin(), getPaymentDiagnosticSnapshot(), getAdminLocale()]);
  const t = createAdminTranslator(locale);
  const emptyValue = t("Não registrado", "未记录");
  const localizedChecks = snapshot.configChecks.map((item) => localizePaymentCheck(item, snapshot.modeLabel, locale));
  const localizedStatus = adminPaymentStatusLabel(snapshot.status, snapshot.modeLabel, locale);
  const localizedFallback = adminPaymentFallbackMessage(snapshot.status, snapshot.modeLabel, snapshot.configChecks, snapshot.fallbackMessage, locale);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">{t("Pagamentos", "支付")}</p>
        <h1>{t("Diagnóstico Mercado Pago", "Mercado Pago 诊断")}</h1>
        <p>
          {t("Verifique se Pix/cartão estão em modo simulado, sandbox ou live. Esta página é somente leitura e não mostra token, secret, database URL nem payload completo.", "检查 Pix / 银行卡当前使用模拟、沙盒还是正式模式。本页仅供读取，不会显示令牌、密钥、数据库 URL 或完整载荷。")}
        </p>
        <div className="admin-actions">
          <Link className="button secondary" href="/admin/pedidos" prefetch={false}>
            {t("Ver pedidos", "查看订单")}
          </Link>
          <Link className="button secondary" href="/admin/prontidao" prefetch={false}>
            {t("Ver prontidão", "查看系统状态")}
          </Link>
        </div>
      </div>

      <section className={`import-panel payment-diagnostic-hero ${statusClass(snapshot.status)}`}>
        <div className="readiness-group-heading">
          <div>
            <span>Checkout Pro</span>
            <h2>{localizedStatus}</h2>
          </div>
          <strong>{adminPaymentModeLabel(snapshot.modeLabel, locale)}</strong>
        </div>
        <p className="table-note">{localizedFallback}</p>
        <div className="payment-doc-links">
          <a
            className="button secondary"
            href="https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro/preferences/create-preference/post"
            rel="noreferrer"
            target="_blank"
          >
            Create preference API
          </a>
          <a
            className="button secondary"
            href="https://www.mercadopago.com.br/developers/en/docs/checkout-pro/payment-notifications"
            rel="noreferrer"
            target="_blank"
          >
            Payment notifications
          </a>
        </div>
      </section>

      <div className="metric-grid compact payment-metrics">
        <div>
          <span>Mercado Pago</span>
          <strong>{snapshot.counts.mercadoPagoPayments}</strong>
          <small>{t("payments registrados", "条付款记录")}</small>
        </div>
        <div>
          <span>{t("Simulado", "模拟付款")}</span>
          <strong>{snapshot.counts.simulatedPayments}</strong>
          <small>{t("fallback/local", "回退 / 本地")}</small>
        </div>
        <div>
          <span>{t("Pendentes", "待付款")}</span>
          <strong>{snapshot.counts.pendingPayments}</strong>
          <small>{t("aguardando pagamento", "等待付款")}</small>
        </div>
        <div>
          <span>Webhooks</span>
          <strong>{snapshot.counts.webhookEvents}</strong>
          <small>{snapshot.counts.invalidWebhookSignatures} {t("assinatura(s) inválida(s)", "个无效签名")}</small>
        </div>
        <div>
          <span>{t("Parcelamento", "分期")}</span>
          <strong>{t("até", "最多")} {snapshot.mercadoPagoMaxInstallments}x</strong>
          <small>{t("Cartão via Checkout Pro", "Checkout Pro 银行卡付款")}</small>
        </div>
      </div>

      <section className="import-panel">
        <div className="readiness-group-heading">
          <div>
            <span>{t("Configuração", "配置")}</span>
            <h2>{t("Checks do Mercado Pago", "Mercado Pago 检查")}</h2>
          </div>
          <strong>{snapshot.configChecks.filter((item) => item.status === "READY").length}/{snapshot.configChecks.length}</strong>
        </div>
        <div className="readiness-signal-list">
          {localizedChecks.map((item) => (
            <article className={`readiness-signal ${item.status.toLowerCase().replace("_", "-")}`} key={item.key}>
              <span>{item.status === "READY" ? t("Pronto", "正常") : item.status === "WARNING" ? t("Revisar", "需要复核") : t("Ação necessária", "必须处理")}</span>
              <strong>{item.label}</strong>
              <small>{item.message}</small>
            </article>
          ))}
        </div>
        <p className="table-note">
          {t("Webhook esperado: ", "预期 Webhook：")}<strong>{snapshot.webhookEndpointPath}</strong>{t(". Em live, configure esta rota com HTTPS público antes de receber pagamentos reais.", "。启用正式付款前，请使用公开 HTTPS 配置此路由。")}
        </p>
      </section>

      <section className="import-panel">
        <div className="readiness-group-heading">
          <div>
            <span>{t("Pagamentos recentes", "近期付款")}</span>
            <h2>{t("Pedidos e provider status", "订单与服务商状态")}</h2>
          </div>
          <strong>{snapshot.recentPayments.length}</strong>
        </div>
        <div className="preview-table-wrap">
          <table className="preview-table payment-diagnostic-table">
            <thead>
              <tr>
                <th>{t("Pedido", "订单")}</th>
                <th>{t("Método", "付款方式")}</th>
                <th>{t("Status", "状态")}</th>
                <th>{t("Provider", "服务商")}</th>
                <th>IDs</th>
                <th>{t("Webhook / erro", "Webhook / 错误")}</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.recentPayments.map((payment) => (
                <tr key={payment.id} className={payment.syncError ? "has-error" : ""}>
                  <td>
                    <Link href={`/admin/pedidos/${payment.orderNumber}`} prefetch={false}>
                      <strong>{payment.orderNumber}</strong>
                    </Link>
                    <small>{payment.orderStatus}</small>
                    <small>{money(payment.amountCents)}</small>
                  </td>
                  <td>
                    <strong>{adminPaymentMethodLabel(payment.method, locale)}</strong>
                    <small>{adminPaymentProviderLabel(payment.provider, locale)}</small>
                  </td>
                  <td>
                    <span className={payment.status === "PAID" ? "status-chip success" : "status-chip"}>
                      {adminPaymentRecordStatusLabel(payment.status, locale)}
                    </span>
                    <small>{payment.providerStatus || t("Sem provider status", "无服务商状态")}</small>
                    {payment.providerStatusDetail ? <small>{payment.providerStatusDetail}</small> : null}
                  </td>
                  <td>{payment.provider}</td>
                  <td>
                    <small>Preference: {shortValue(payment.providerPreferenceId, emptyValue)}</small>
                    <small>Payment: {shortValue(payment.providerPaymentId, emptyValue)}</small>
                    <small>Ref: {shortValue(payment.providerExternalReference, emptyValue)}</small>
                  </td>
                  <td>
                    <small>{formatAdminDateTime(payment.lastWebhookAt, emptyValue, locale)}</small>
                    {payment.syncError ? <small>{payment.syncError}</small> : <small>{t("Sem erro de sincronização", "无同步错误")}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!snapshot.recentPayments.length ? (
          <div className="empty-state">
            <strong>{t("Nenhum pagamento registrado", "暂无付款记录")}</strong>
            <p>{t("Crie um pedido de teste pelo checkout para ver o resumo aqui.", "通过结账创建测试订单后，可在此查看摘要。")}</p>
          </div>
        ) : null}
      </section>

      <section className="import-panel">
        <div className="readiness-group-heading">
          <div>
            <span>{t("Webhooks recentes", "近期 Webhook")}</span>
            <h2>{t("Eventos desidentificados", "去标识化事件")}</h2>
          </div>
          <strong>{snapshot.recentWebhookEvents.length}</strong>
        </div>
        <div className="preview-table-wrap">
          <table className="preview-table payment-diagnostic-table">
            <thead>
              <tr>
                <th>{t("Evento", "事件")}</th>
                <th>Data ID</th>
                <th>{t("Tipo / ação", "类型 / 动作")}</th>
                <th>{t("Assinatura", "签名")}</th>
                <th>{t("Processamento", "处理状态")}</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.recentWebhookEvents.map((event) => (
                <tr key={event.id} className={event.signatureValid ? "" : "has-error"}>
                  <td>
                    <strong>{shortValue(event.providerEventId, emptyValue)}</strong>
                    <small>Request: {shortValue(event.requestId, emptyValue)}</small>
                  </td>
                  <td>{shortValue(event.dataId, emptyValue)}</td>
                  <td>
                    <strong>{event.eventType || t("Sem tipo", "无类型")}</strong>
                    <small>{event.action || t("Sem ação", "无动作")}</small>
                  </td>
                  <td>
                    <span className={event.signatureValid ? "status-chip success" : "status-chip warning"}>
                      {event.signatureValid ? t("Válida", "有效") : t("Inválida", "无效")}
                    </span>
                  </td>
                  <td>
                    <small>{t("Criado: ", "创建时间：")}{formatAdminDateTime(event.createdAt, emptyValue, locale)}</small>
                    <small>{t("Processado: ", "处理时间：")}{formatAdminDateTime(event.processedAt, emptyValue, locale)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!snapshot.recentWebhookEvents.length ? (
          <div className="empty-state">
            <strong>{t("Nenhum webhook recebido", "尚未收到 Webhook")}</strong>
            <p>{t("Isso é esperado enquanto a loja estiver local ou sem URL HTTPS pública.", "当店铺仍在本地运行或没有公开 HTTPS URL 时，这是正常情况。")}</p>
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
