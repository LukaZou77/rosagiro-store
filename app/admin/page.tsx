import Link from "next/link";
import { ArrowUpRight, CheckCircle2, MessageCircleMore, PackageX, ReceiptText, ShoppingBag } from "lucide-react";
import { AdminBusinessTrend } from "@/components/AdminBusinessTrend";
import { AdminProductLeaderboards } from "@/components/AdminProductLeaderboards";
import { AdminShell } from "@/components/AdminShell";
import { getAdminBusinessAnalytics, type BusinessMetricKey } from "@/lib/admin-business-analytics";
import { requireAdmin } from "@/lib/auth";
import { getLaunchReadinessSnapshot } from "@/lib/launch-readiness";
import { money } from "@/lib/money";
import { getPaymentDiagnosticSnapshot } from "@/lib/payment-diagnostics";
import { getAdminOperationsDashboard } from "@/lib/site-analytics";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

const orderStatusLabels: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  FULFILLING: "Em separação",
  SHIPPED: "Enviado",
  CANCELED: "Cancelado"
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

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function metricValue(key: BusinessMetricKey, value: number) {
  return key === "paidRevenueCents" ? money(value) : value.toLocaleString("pt-BR");
}

function Change({ state, percent, delta, metric }: { state: string; percent: number | null; delta: number; metric: BusinessMetricKey }) {
  if (state === "no_data") return <span className="admin-change is-muted">Sem comparação</span>;
  if (state === "new") return <span className="admin-change is-up">Novo</span>;
  const direction = state === "up" ? "is-up" : state === "down" ? "is-down" : "is-flat";
  return (
    <span className={`admin-change ${direction}`}>
      {delta > 0 ? "+" : ""}{metricValue(metric, delta)} {percent === null ? "" : `(${percent > 0 ? "+" : ""}${percent.toLocaleString("pt-BR")}%)`}
    </span>
  );
}

export default async function AdminPage({ searchParams }: PageProps) {
  const [admin, params] = await Promise.all([requireAdmin(), searchParams]);
  const period = single(params.period);
  const compare = single(params.compare);
  const [analytics, operations, launchSnapshot, paymentSnapshot] = await Promise.all([
    getAdminBusinessAnalytics(period, compare),
    getAdminOperationsDashboard(7),
    getLaunchReadinessSnapshot(),
    getPaymentDiagnosticSnapshot()
  ]);
  const hasOperationalTasks =
    operations.operations.pendingOrders > 0 ||
    operations.operations.outOfStockCount > 0 ||
    launchSnapshot.actionRequiredCount > 0;

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Visão geral</p>
          <h1>Operação de hoje</h1>
          <p>Pedidos, pagamentos, audiência e consultas no horário de São Paulo.</p>
        </div>
        <div className="admin-heading-actions"><Link className="button secondary" href="/admin/leads">Registrar lead</Link><Link className="button primary" href="/admin/pedidos">Ver pedidos</Link></div>
      </div>

      <div className="admin-analytics-toolbar">
        <nav className="admin-period-tabs" aria-label="Período do dashboard">
          {([['today', 'Hoje'], ['week', 'Semana'], ['month', 'Mês'], ['year', 'Ano']] as const).map(([value, label]) => (
            <Link className={analytics.period === value ? "is-active" : ""} href={`/admin?period=${value}&compare=${analytics.comparison}`} key={value}>{label}</Link>
          ))}
        </nav>
        <form action="/admin" className="admin-comparison-control">
          <input type="hidden" name="period" value={analytics.period} />
          <label>Comparar com<select name="compare" defaultValue={analytics.comparison}><option value="previous_period">Período anterior</option><option value="previous_year">Mesmo período do ano anterior</option></select></label>
          <button type="submit">Aplicar</button>
        </form>
      </div>

      <section className="admin-metric-strip" aria-label="Indicadores do período">
        {metricLabels.map((item) => {
          const change = analytics.kpis[item.key];
          return (
            <div key={item.key}>
              <span>{item.label}</span>
              <strong>{metricValue(item.key, change.current)}</strong>
              <small>{item.detail}</small>
              <Change state={change.state} percent={change.percent} delta={change.delta} metric={item.key} />
            </div>
          );
        })}
      </section>

      <div className="admin-operations-layout">
        <section className="admin-work-surface admin-orders-worklist">
          <div className="admin-section-heading"><div><span>Comercial</span><h2>Pedidos para tratar</h2></div><Link href="/admin/pedidos">Ver todos</Link></div>
          <div className="admin-compact-table-wrap">
            <table className="admin-data-table">
              <thead><tr><th>Pedido</th><th>Cliente</th><th>Status</th><th>Itens</th><th>Total</th></tr></thead>
              <tbody>
                {operations.operations.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td><Link href={`/admin/pedidos/${order.orderNumber}`}>{order.orderNumber}</Link><small>{dateTimeFormatter.format(new Date(order.createdAt))}</small></td>
                    <td>{order.customerName}</td>
                    <td><span className={`admin-status-dot status-${order.status.toLowerCase()}`}>{orderStatusLabels[order.status]}</span></td>
                    <td>{order._count.items}</td>
                    <td><strong>{money(order.totalCents)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!operations.operations.recentOrders.length ? <div className="admin-empty-compact">Nenhum pedido registrado.</div> : null}
          </div>
        </section>

        <section className="admin-work-surface admin-attention-list">
          <div className="admin-section-heading"><div><span>Prioridades</span><h2>Precisa de atenção</h2></div></div>
          {operations.operations.pendingOrders > 0 ? <Link href="/admin/pedidos?status=PENDING_PAYMENT"><span className="is-orange"><ShoppingBag size={18} /></span><div><strong>{operations.operations.pendingOrders} pedidos aguardando</strong><small>Revisar pagamento</small></div><ArrowUpRight size={15} /></Link> : null}
          {operations.operations.outOfStockCount > 0 ? <Link href="/admin/produtos?stock=out"><span className="is-red"><PackageX size={18} /></span><div><strong>{operations.operations.outOfStockCount} produtos sem estoque</strong><small>Atualizar catálogo</small></div><ArrowUpRight size={15} /></Link> : null}
          {launchSnapshot.actionRequiredCount > 0 ? <Link href="/admin/prontidao"><span className="is-neutral"><ReceiptText size={18} /></span><div><strong>{launchSnapshot.actionRequiredCount} alertas do sistema</strong><small>Verificar configuração</small></div><ArrowUpRight size={15} /></Link> : null}
          {analytics.current.qualifiedLeads > 0 ? <Link href="/admin/leads"><span className="is-green"><MessageCircleMore size={18} /></span><div><strong>{analytics.current.qualifiedLeads} leads qualificados</strong><small>Acompanhar conversas</small></div><ArrowUpRight size={15} /></Link> : null}
          {!hasOperationalTasks && analytics.current.qualifiedLeads === 0 ? <div className="admin-task-empty"><span><CheckCircle2 size={18} /></span><div><strong>Operação em dia</strong><small>Nenhuma ação imediata.</small></div></div> : null}
        </section>
      </div>

      <AdminBusinessTrend data={analytics.trend} comparisonLabel={analytics.comparisonLabel} />

      <div className="admin-insight-grid">
        <section className="admin-work-surface admin-funnel-summary">
          <div className="admin-section-heading"><div><span>Conversão</span><h2>Do interesse ao pagamento</h2></div><Link href="/admin/analytics">Abrir relatório</Link></div>
          <div><span>Cliques no WhatsApp</span><strong>{analytics.current.whatsappSessions}</strong><small>{analytics.current.whatsappClicks} cliques totais</small></div>
          <div><span>Leads qualificados</span><strong>{analytics.current.qualifiedLeads}</strong><small>{analytics.funnel.whatsappClickToLeadRate === null ? "Sem base" : `${analytics.funnel.whatsappClickToLeadRate}% dos cliques`}</small></div>
          <div><span>Pedidos pagos</span><strong>{analytics.current.paidOrders}</strong><small>{analytics.funnel.orderToPaidRate === null ? "Sem base" : `${analytics.funnel.orderToPaidRate}% dos pedidos criados`}</small></div>
          <div><span>Receita paga</span><strong>{money(analytics.current.paidRevenueCents)}</strong><small>Valores aprovados</small></div>
        </section>

        <section className="admin-work-surface admin-location-panel">
          <div className="admin-section-heading"><div><span>Audiência recente</span><h2>Principais localidades</h2></div><small>Últimos 7 dias</small></div>
          {operations.locations.length ? <div className="admin-ranked-list">{operations.locations.slice(0, 6).map((location, index) => <div key={location.label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{location.label}</strong><small>{location.visitors} visitantes · {location.pageViews} páginas</small></div>)}</div> : <div className="admin-empty-compact">Os dados de região aparecem após novas visitas.</div>}
        </section>
      </div>

      <AdminProductLeaderboards leaderboards={analytics.leaderboards} compact />

      <section className="admin-system-strip">
        <div><span>Catálogo</span><strong>{operations.operations.productCount} produtos</strong></div>
        <div><span>Mercado Pago</span><strong className={`is-${paymentSnapshot.status.toLowerCase().replace("_", "-")}`}>{paymentSnapshot.statusLabel}</strong></div>
        <div><span>Sistema</span><strong>{launchSnapshot.readyCount}/{launchSnapshot.signals.length} verificações</strong></div>
        <div className="admin-system-actions"><Link href="/admin/pagamentos">Pagamento</Link><Link href="/admin/prontidao">Saúde do sistema</Link></div>
      </section>
    </AdminShell>
  );
}
