import Link from "next/link";
import { ArrowUpRight, CheckCircle2, MessageCircleMore, PackageX, ReceiptText, ShoppingBag } from "lucide-react";
import { AdminBusinessTrend } from "@/components/AdminBusinessTrend";
import { AdminProductLeaderboards } from "@/components/AdminProductLeaderboards";
import { AdminShell } from "@/components/AdminShell";
import { getAdminBusinessAnalytics, type BusinessMetricKey } from "@/lib/admin-business-analytics";
import { createAdminTranslator } from "@/lib/admin-i18n";
import { adminPaymentStatusLabel } from "@/lib/admin-i18n-content";
import { getAdminLocale } from "@/lib/admin-i18n-server";
import { requireAdmin } from "@/lib/auth";
import { getLaunchReadinessSnapshot } from "@/lib/launch-readiness";
import { money } from "@/lib/money";
import { buildPaymentConfigDiagnostics } from "@/lib/payment-diagnostics";
import { getAdminOperationsDashboard } from "@/lib/site-analytics";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const orderStatusLabels: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  FULFILLING: "Em separação",
  SHIPPED: "Enviado",
  CANCELED: "Cancelado"
};

const orderStatusLabelsZh: Record<string, string> = {
  PENDING_PAYMENT: "等待付款",
  PAID: "已付款",
  FULFILLING: "配货中",
  SHIPPED: "已发货",
  CANCELED: "已取消"
};

const metricLabels: Array<{ key: BusinessMetricKey; label: string; detail: string }> = [
  { key: "visitors", label: "Visitantes", detail: "pessoas únicas" },
  { key: "pageViews", label: "Visualizações", detail: "páginas abertas" },
  { key: "createdOrders", label: "Pedidos criados", detail: "intenção de compra" },
  { key: "paidOrders", label: "Pedidos pagos", detail: "pagamento aprovado" },
  { key: "paidRevenueCents", label: "Receita paga", detail: "somente valores recebidos" },
  { key: "whatsappSessions", label: "Cliques WhatsApp", detail: "sessões com clique" },
  { key: "qualifiedLeads", label: "Leads qualificados", detail: "conversas registradas" }
];

const metricLabelsZh: Record<BusinessMetricKey, { label: string; detail: string }> = {
  visitors: { label: "访客", detail: "独立访客" },
  pageViews: { label: "浏览量", detail: "页面打开次数" },
  createdOrders: { label: "创建订单", detail: "购买意向" },
  paidOrders: { label: "已付款订单", detail: "付款已批准" },
  paidRevenueCents: { label: "已付款收入", detail: "仅统计实收金额" },
  whatsappSessions: { label: "WhatsApp 点击", detail: "发生点击的会话" },
  qualifiedLeads: { label: "有效询盘", detail: "已登记的真实沟通" }
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function metricValue(key: BusinessMetricKey, value: number, locale = "pt-BR") {
  return key === "paidRevenueCents" ? money(value) : value.toLocaleString(locale);
}

function Change({ state, percent, delta, metric, locale, t }: { state: string; percent: number | null; delta: number; metric: BusinessMetricKey; locale: string; t: (pt: string, zh: string) => string }) {
  if (state === "no_data") return <span className="admin-change is-muted">{t("Sem comparação", "暂无对比")}</span>;
  if (state === "new") return <span className="admin-change is-up">{t("Novo", "新增")}</span>;
  const direction = state === "up" ? "is-up" : state === "down" ? "is-down" : "is-flat";
  return (
    <span className={`admin-change ${direction}`}>
      {delta > 0 ? "+" : ""}{metricValue(metric, delta, locale)} {percent === null ? "" : `(${percent > 0 ? "+" : ""}${percent.toLocaleString(locale)}%)`}
    </span>
  );
}

export default async function AdminPage({ searchParams }: PageProps) {
  const [admin, params, locale] = await Promise.all([requireAdmin(), searchParams, getAdminLocale()]);
  const t = createAdminTranslator(locale);
  const dateTimeFormatter = new Intl.DateTimeFormat(locale, {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  const period = single(params.period);
  const compare = single(params.compare);
  const paymentSnapshot = buildPaymentConfigDiagnostics();
  const [analytics, operations, launchSnapshotResult] = await Promise.all([
    getAdminBusinessAnalytics(period, compare),
    getAdminOperationsDashboard(7),
    getLaunchReadinessSnapshot().catch((error) => {
      console.error("[admin-dashboard] readiness unavailable", {
        message: error instanceof Error ? error.message : String(error)
      });
      return null;
    })
  ]);
  const launchSnapshot = launchSnapshotResult || {
    actionRequiredCount: 0,
    readyCount: 0,
    signals: []
  };
  const dashboardPartiallyUnavailable = !analytics.available || !operations.available || !launchSnapshotResult;
  const hasOperationalTasks =
    operations.operations.pendingOrders > 0 ||
    operations.operations.outOfStockCount > 0 ||
    launchSnapshot.actionRequiredCount > 0;
  const comparisonLabel = analytics.comparison === "previous_year"
    ? t("Mesmo período do ano anterior", "去年同期")
    : t("Período anterior", "上一周期");

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">{t("Visão geral", "经营总览")}</p>
          <h1>{t("Operação de hoje", "今日经营")}</h1>
          <p>{t("Pedidos, pagamentos, audiência e consultas no horário de São Paulo.", "订单、付款、访客和询盘均按圣保罗时间统计。")}</p>
        </div>
        <div className="admin-heading-actions"><Link className="button secondary" href="/admin/leads" prefetch={false}>{t("Registrar lead", "登记询盘")}</Link><Link className="button primary" href="/admin/pedidos" prefetch={false}>{t("Ver pedidos", "查看订单")}</Link></div>
      </div>

      {dashboardPartiallyUnavailable ? <div className="admin-notice warning" role="status">{t("Alguns indicadores estão temporariamente indisponíveis. Pedidos e demais operações continuam acessíveis.", "部分指标暂时不可用，订单和其他运营功能仍可正常使用。")}</div> : null}

      <div className="admin-analytics-toolbar">
        <nav className="admin-period-tabs" aria-label={t("Período do dashboard", "总览统计周期")}>
          {([['today', t('Hoje', '今日')], ['week', t('Semana', '本周')], ['month', t('Mês', '本月')], ['year', t('Ano', '本年')]] as const).map(([value, label]) => (
            <Link className={analytics.period === value ? "is-active" : ""} href={`/admin?period=${value}&compare=${analytics.comparison}`} prefetch={false} key={value}>{label}</Link>
          ))}
        </nav>
        <form action="/admin" className="admin-comparison-control">
          <input type="hidden" name="period" value={analytics.period} />
          <label>{t("Comparar com", "对比范围")}<select name="compare" defaultValue={analytics.comparison}><option value="previous_period">{t("Período anterior", "上一周期")}</option><option value="previous_year">{t("Mesmo período do ano anterior", "去年同期")}</option></select></label>
          <button type="submit">{t("Aplicar", "应用")}</button>
        </form>
      </div>

      <section className="admin-metric-strip" aria-label={t("Indicadores do período", "周期经营指标")}>
        {metricLabels.map((item) => {
          const change = analytics.kpis[item.key];
          return (
            <div key={item.key}>
              <span>{locale === "zh-CN" ? metricLabelsZh[item.key].label : item.label}</span>
              <strong>{metricValue(item.key, change.current, locale)}</strong>
              <small>{locale === "zh-CN" ? metricLabelsZh[item.key].detail : item.detail}</small>
              <Change state={change.state} percent={change.percent} delta={change.delta} metric={item.key} locale={locale} t={t} />
            </div>
          );
        })}
      </section>

      <div className="admin-operations-layout">
        <section className="admin-work-surface admin-orders-worklist">
          <div className="admin-section-heading"><div><span>{t("Comercial", "销售")}</span><h2>{t("Pedidos para tratar", "待处理订单")}</h2></div><Link href="/admin/pedidos" prefetch={false}>{t("Ver todos", "查看全部")}</Link></div>
          <div className="admin-compact-table-wrap">
            <table className="admin-data-table">
              <thead><tr><th>{t("Pedido", "订单")}</th><th>{t("Cliente", "客户")}</th><th>{t("Status", "状态")}</th><th>{t("Itens", "商品")}</th><th>{t("Total", "总额")}</th></tr></thead>
              <tbody>
                {operations.operations.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td><Link href={`/admin/pedidos/${order.orderNumber}`} prefetch={false}>{order.orderNumber}</Link><small>{dateTimeFormatter.format(new Date(order.createdAt))}</small></td>
                    <td>{order.customerName}</td>
                    <td><span className={`admin-status-dot status-${order.status.toLowerCase()}`}>{locale === "zh-CN" ? orderStatusLabelsZh[order.status] : orderStatusLabels[order.status]}</span></td>
                    <td>{order._count.items}</td>
                    <td><strong>{money(order.totalCents)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!operations.operations.recentOrders.length ? <div className="admin-empty-compact">{t("Nenhum pedido registrado.", "暂无订单。")}</div> : null}
          </div>
        </section>

        <section className="admin-work-surface admin-attention-list">
          <div className="admin-section-heading"><div><span>{t("Prioridades", "优先事项")}</span><h2>{t("Precisa de atenção", "需要关注")}</h2></div></div>
          {operations.operations.pendingOrders > 0 ? <Link href="/admin/pedidos?status=PENDING_PAYMENT" prefetch={false}><span className="is-orange"><ShoppingBag size={18} /></span><div><strong>{operations.operations.pendingOrders} {t("pedidos aguardando", "个订单待付款")}</strong><small>{t("Revisar pagamento", "核对付款")}</small></div><ArrowUpRight size={15} /></Link> : null}
          {operations.operations.outOfStockCount > 0 ? <Link href="/admin/produtos?stock=out" prefetch={false}><span className="is-red"><PackageX size={18} /></span><div><strong>{operations.operations.outOfStockCount} {t("produtos sem estoque", "个商品缺货")}</strong><small>{t("Atualizar catálogo", "更新商品目录")}</small></div><ArrowUpRight size={15} /></Link> : null}
          {launchSnapshot.actionRequiredCount > 0 ? <Link href="/admin/prontidao" prefetch={false}><span className="is-neutral"><ReceiptText size={18} /></span><div><strong>{launchSnapshot.actionRequiredCount} {t("alertas do sistema", "项系统提醒")}</strong><small>{t("Verificar configuração", "检查配置")}</small></div><ArrowUpRight size={15} /></Link> : null}
          {analytics.current.qualifiedLeads > 0 ? <Link href="/admin/leads" prefetch={false}><span className="is-green"><MessageCircleMore size={18} /></span><div><strong>{analytics.current.qualifiedLeads} {t("leads qualificados", "条有效询盘")}</strong><small>{t("Acompanhar conversas", "跟进沟通")}</small></div><ArrowUpRight size={15} /></Link> : null}
          {!hasOperationalTasks && analytics.current.qualifiedLeads === 0 ? <div className="admin-task-empty"><span><CheckCircle2 size={18} /></span><div><strong>{t("Operação em dia", "运营正常")}</strong><small>{t("Nenhuma ação imediata.", "目前没有需要立即处理的事项。")}</small></div></div> : null}
        </section>
      </div>

      <AdminBusinessTrend data={analytics.trend} comparisonLabel={comparisonLabel} />

      <div className="admin-insight-grid">
        <section className="admin-work-surface admin-funnel-summary">
          <div className="admin-section-heading"><div><span>{t("Conversão", "转化")}</span><h2>{t("Do interesse ao pagamento", "从兴趣到付款")}</h2></div><Link href="/admin/analytics" prefetch={false}>{t("Abrir relatório", "打开报表")}</Link></div>
          <div><span>{t("Cliques no WhatsApp", "WhatsApp 点击")}</span><strong>{analytics.current.whatsappSessions}</strong><small>{analytics.current.whatsappClicks} {t("cliques totais", "次总点击")}</small></div>
          <div><span>{t("Leads qualificados", "有效询盘")}</span><strong>{analytics.current.qualifiedLeads}</strong><small>{analytics.funnel.whatsappClickToLeadRate === null ? t("Sem base", "暂无基数") : `${analytics.funnel.whatsappClickToLeadRate}% ${t("dos cliques", "的点击转化")}`}</small></div>
          <div><span>{t("Pedidos pagos", "已付款订单")}</span><strong>{analytics.current.paidOrders}</strong><small>{analytics.funnel.orderToPaidRate === null ? t("Sem base", "暂无基数") : `${analytics.funnel.orderToPaidRate}% ${t("dos pedidos criados", "的创建订单已付款")}`}</small></div>
          <div><span>{t("Receita paga", "已付款收入")}</span><strong>{money(analytics.current.paidRevenueCents)}</strong><small>{t("Valores aprovados", "已批准金额")}</small></div>
        </section>

        <section className="admin-work-surface admin-location-panel">
          <div className="admin-section-heading"><div><span>{t("Audiência recente", "近期访客")}</span><h2>{t("Principais localidades", "主要地区")}</h2></div><small>{t("Últimos 7 dias", "最近 7 天")}</small></div>
          {operations.locations.length ? <div className="admin-ranked-list">{operations.locations.slice(0, 6).map((location, index) => <div key={location.label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{location.label}</strong><small>{location.visitors} {t("visitantes", "位访客")} · {location.pageViews} {t("páginas", "次浏览")}</small></div>)}</div> : <div className="admin-empty-compact">{t("Os dados de região aparecem após novas visitas.", "产生新访客后将显示地区数据。")}</div>}
        </section>
      </div>

      <AdminProductLeaderboards leaderboards={analytics.leaderboards} compact />

      <section className="admin-system-strip">
        <div><span>{t("Catálogo", "商品目录")}</span><strong>{operations.operations.productCount} {t("produtos", "个商品")}</strong></div>
        <div><span>Mercado Pago</span><strong className={`is-${paymentSnapshot.status.toLowerCase().replace("_", "-")}`}>{adminPaymentStatusLabel(paymentSnapshot.status, paymentSnapshot.modeLabel, locale)}</strong></div>
        <div><span>{t("Sistema", "系统")}</span><strong>{launchSnapshot.readyCount}/{launchSnapshot.signals.length} {t("verificações", "项检查通过")}</strong></div>
        <div className="admin-system-actions"><Link href="/admin/pagamentos" prefetch={false}>{t("Pagamento", "支付")}</Link><Link href="/admin/prontidao" prefetch={false}>{t("Saúde do sistema", "系统状态")}</Link></div>
      </section>
    </AdminShell>
  );
}
