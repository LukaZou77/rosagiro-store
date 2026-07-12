import { notFound } from "next/navigation";
import { confirmManualPixPaymentAction, updateOrderStatusAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { createAdminTranslator } from "@/lib/admin-i18n";
import { getAdminLocale } from "@/lib/admin-i18n-server";
import { formatAdminDateTime } from "@/lib/date-format";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { paymentMethodLabel, paymentProviderLabel, paymentStatusLabel } from "@/lib/payments";

const statusLabels: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  FULFILLING: "Em separação",
  SHIPPED: "Enviado",
  CANCELED: "Cancelado"
};

const statusLabelsZh: Record<string, string> = {
  PENDING_PAYMENT: "等待付款",
  PAID: "已付款",
  FULFILLING: "配货中",
  SHIPPED: "已发货",
  CANCELED: "已取消"
};

const addressMatchLabels: Record<string, string> = {
  VALIDATED: "Validado",
  NEEDS_REVIEW: "Conferir manualmente",
  FAILED: "Falhou",
  DISABLED: "Não configurado",
  NOT_CHECKED: "Não checado"
};

const addressMatchLabelsZh: Record<string, string> = {
  VALIDATED: "已验证",
  NEEDS_REVIEW: "需人工核对",
  FAILED: "验证失败",
  DISABLED: "未配置",
  NOT_CHECKED: "未检查"
};

type PageProps = {
  params: Promise<{ orderNumber: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOrderDetailPage({ params, searchParams }: PageProps) {
  const [admin, locale] = await Promise.all([requireAdmin(), getAdminLocale()]);
  const t = createAdminTranslator(locale);
  const localizedStatusLabels = locale === "zh-CN" ? statusLabelsZh : statusLabels;
  const localizedAddressLabels = locale === "zh-CN" ? addressMatchLabelsZh : addressMatchLabels;
  const { orderNumber } = await params;
  const query = searchParams ? await searchParams : {};
  const saved = single(query.saved);
  const error = single(query.error);
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true, payment: true }
  });
  if (!order) notFound();

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">{t("Pedido", "订单")}</p>
        <h1>{order.orderNumber}</h1>
      </div>
      {saved ? (
        <div className="admin-notice success" role="status">
          {t("Pedido atualizado com sucesso.", "订单更新成功。")}
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}
      <section className="admin-detail-grid">
        <div className="cart-panel">
          <h2>{t("Cliente", "客户")}</h2>
          <p>{order.customerName}</p>
          <p>{order.customerEmail}</p>
          <p>{order.customerPhone} / CPF {order.customerCpf}</p>
          <p>
            {order.street}, {order.number} {order.complement ? `- ${order.complement}` : ""}
          </p>
          <p>
            {order.district}, {order.city} - {order.state}, CEP {order.cep}
          </p>
          <div className={`address-match-card admin ${order.addressMatchStatus.toLowerCase().replace("_", "-")}`}>
            <span>{localizedAddressLabels[order.addressMatchStatus] || order.addressMatchStatus}</span>
            <strong>{order.addressMatchFormatted || t("Endereço salvo sem padronização externa", "地址已保存，但未经外部标准化")}</strong>
            <small>{order.addressMatchMessage || t("Confira antes do envio.", "发货前请核对。")}</small>
            {order.addressLatitude !== null && order.addressLongitude !== null ? (
              <small>
                {t("Coordenadas: ", "坐标：")}{order.addressLatitude.toFixed(6)}, {order.addressLongitude.toFixed(6)}
              </small>
            ) : null}
            {order.addressMatchPlaceId ? <small>Place ID: {order.addressMatchPlaceId}</small> : null}
            {order.addressMatchGranularity ? <small>{t("Granularidade: ", "地址精度：")}{order.addressMatchGranularity}</small> : null}
          </div>
        </div>
        <div className="summary-panel">
          <h2>{t("Status", "状态")}</h2>
          <form action={updateOrderStatusAction} className="status-form detail-status-form">
            <input type="hidden" name="orderNumber" value={order.orderNumber} />
            <select name="status" defaultValue={order.status}>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {localizedStatusLabels[value] || label}
                </option>
              ))}
            </select>
            <button className="button primary" type="submit">
              {t("Atualizar status", "更新状态")}
            </button>
          </form>
          <div className="summary-block">
            <div>
              <span>{t("Pagamento", "付款")}</span>
              <strong>
                {paymentProviderLabel(order.payment?.provider)} / {paymentMethodLabel(order.payment?.method)}
              </strong>
              <small>{paymentStatusLabel(order.payment?.status)}</small>
            </div>
            <div>
              <span>{t("Subtotal", "商品小计")}</span>
              <strong>{money(order.subtotalCents)}</strong>
            </div>
            {order.discountCents > 0 ? (
              <div>
                <span>{t("Desconto", "折扣")}</span>
                <strong>-{money(order.discountCents)}</strong>
              </div>
            ) : null}
            <div>
              <span>{t("Frete", "运费")}</span>
              <strong>{money(order.shippingCents)}</strong>
            </div>
            <div>
              <span>{t("Método", "配送方式")}</span>
              <strong>{order.shippingServiceLabel || order.shippingMethod}</strong>
            </div>
            <div className="summary-total">
              <span>{t("Total", "总额")}</span>
              <strong>{money(order.totalCents)}</strong>
            </div>
          </div>
          <div className={`address-match-card admin ${order.shippingQuoteStatus.toLowerCase().replace("_", "-")}`}>
            <span>{order.shippingQuoteStatus}</span>
            <strong>
              {order.shippingCarrier || t("Frete", "运费")} {order.shippingZone ? `/ ${order.shippingZone}` : ""}
            </strong>
            <small>{order.shippingQuoteMessage || t("Frete salvo para conferência.", "运费已保存，等待核对。")}</small>
            {order.shippingWeightGrams ? (
              <small>
                {t("Peso cobrado: ", "计费重量：")}{(order.shippingWeightGrams / 1000).toLocaleString(locale, { maximumFractionDigits: 3 })} kg
              </small>
            ) : null}
            {order.shippingRateId ? <small>Rate ID: {order.shippingRateId}</small> : null}
          </div>
          {order.payment?.provider === "MERCADO_PAGO" ? (
            <div className={`address-match-card admin ${order.payment.syncError ? "failed" : "needs-review"}`}>
              <span>Mercado Pago</span>
              <strong>{order.payment.providerStatus || t("Aguardando status", "等待状态更新")}</strong>
              {order.payment.providerStatusDetail ? <small>{t("Detalhe: ", "详情：")}{order.payment.providerStatusDetail}</small> : null}
              {order.payment.providerPreferenceId ? <small>Preference ID: {order.payment.providerPreferenceId}</small> : null}
              {order.payment.providerPaymentId ? <small>Payment ID: {order.payment.providerPaymentId}</small> : null}
              {order.payment.lastWebhookAt ? <small>Webhook: {formatAdminDateTime(order.payment.lastWebhookAt, t("Sem registro", "未记录"), locale)}</small> : null}
              {order.payment.syncError ? <small>{order.payment.syncError}</small> : null}
            </div>
          ) : null}
          {order.payment?.method === "PIX" && order.status === "PENDING_PAYMENT" ? (
            <form action={confirmManualPixPaymentAction} className="address-match-card admin needs-review manual-pix-admin-card">
              <input type="hidden" name="orderNumber" value={order.orderNumber} />
              <span>{t("Pix manual", "人工 Pix")}</span>
              <strong>{t("Confirme somente depois de conferir o comprovante no WhatsApp ou extrato.", "仅在通过 WhatsApp 凭证或银行流水确认到账后操作。")}</strong>
              <small>{t("Esta ação marca o pedido e o pagamento como pagos. A disponibilidade continua sob controle manual no cadastro do produto.", "此操作会将订单和付款标记为已支付；商品库存仍需在商品资料中人工维护。")}</small>
              <button className="button primary" type="submit">
                {t("Confirmar Pix recebido", "确认已收到 Pix")}
              </button>
            </form>
          ) : null}
        </div>
      </section>
      <section className="cart-panel admin-order-items">
        <h2>{t("Itens", "订单商品")}</h2>
        {order.items.map((item) => (
          <article className="cart-row" key={item.id}>
            <img src={item.productImage} alt={item.productName} />
            <div>
              <span>{item.productBrand}</span>
              <strong>{item.productName}</strong>
              {item.productSkuName ? <small>{item.productSkuName} #{item.productSkuCode}</small> : null}
              <small>
                {item.quantity} x {money(item.unitPriceCents)}
              </small>
            </div>
            <strong>{money(item.lineTotalCents)}</strong>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
