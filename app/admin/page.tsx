import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Eye, PackageX, ReceiptText, ShoppingBag, Users } from "lucide-react";
import { AdminDashboardCharts } from "@/components/AdminDashboardCharts";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { getLaunchReadinessSnapshot } from "@/lib/launch-readiness";
import { money } from "@/lib/money";
import { getPaymentDiagnosticSnapshot } from "@/lib/payment-diagnostics";
import { getAdminOperationsDashboard } from "@/lib/site-analytics";
import { parseSiteAnalyticsRange } from "@/lib/site-analytics-core";

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

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Change({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={`admin-kpi-change ${positive ? "is-positive" : "is-negative"}`}>
      {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
    </span>
  );
}

export default async function AdminPage({ searchParams }: PageProps) {
  const [admin, params] = await Promise.all([requireAdmin(), searchParams]);
  const range = parseSiteAnalyticsRange(single(params.range));
  const [dashboard, launchSnapshot, paymentSnapshot] = await Promise.all([
    getAdminOperationsDashboard(range),
    getLaunchReadinessSnapshot(),
    getPaymentDiagnosticSnapshot()
  ]);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Visão geral</p>
          <h1>Operação de hoje</h1>
          <p>Visitantes, pedidos e alertas no horário de São Paulo.</p>
        </div>
        <div className="admin-range-control" aria-label="Período do dashboard">
          {[7, 30, 90].map((value) => (
            <Link className={range === value ? "is-active" : ""} href={`/admin?range=${value}`} key={value}>
              {value} dias
            </Link>
          ))}
        </div>
      </div>

      <section className="admin-kpi-grid" aria-label="Indicadores de hoje">
        <article className="admin-kpi-card">
          <span className="admin-kpi-icon is-burgundy"><Users size={20} /></span>
          <div><small>Visitantes hoje</small><strong>{dashboard.kpis.visitors.value}</strong></div>
          <Change value={dashboard.kpis.visitors.change} />
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-icon is-blue"><Eye size={20} /></span>
          <div><small>Visualizações hoje</small><strong>{dashboard.kpis.pageViews.value}</strong></div>
          <Change value={dashboard.kpis.pageViews.change} />
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-icon is-orange"><ShoppingBag size={20} /></span>
          <div><small>Pedidos hoje</small><strong>{dashboard.kpis.orders.value}</strong></div>
          <Change value={dashboard.kpis.orders.change} />
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-icon is-green"><ReceiptText size={20} /></span>
          <div><small>Receita paga hoje</small><strong>{money(dashboard.kpis.revenueCents.value)}</strong></div>
          <Change value={dashboard.kpis.revenueCents.change} />
        </article>
      </section>

      <AdminDashboardCharts data={dashboard.trend} />

      <div className="admin-dashboard-grid admin-dashboard-grid-secondary">
        <section className="admin-panel admin-location-panel">
          <div className="admin-panel-heading">
            <div><span>Distribuição</span><h2>Principais localidades</h2></div>
            <small>{range} dias</small>
          </div>
          {dashboard.locations.length ? (
            <div className="admin-ranked-list">
              {dashboard.locations.map((location, index) => (
                <div key={location.label}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{location.label}</strong>
                  <small>{location.visitors} visitantes · {location.pageViews} páginas</small>
                </div>
              ))}
            </div>
          ) : <div className="admin-empty-compact">Os dados de região começam a aparecer após novas visitas.</div>}
        </section>

        <section className="admin-panel admin-task-panel">
          <div className="admin-panel-heading"><div><span>Atenção</span><h2>Fila operacional</h2></div></div>
          <div className="admin-task-list">
            <Link href="/admin/pedidos?status=PENDING_PAYMENT">
              <span className="is-orange"><ShoppingBag size={18} /></span>
              <div><strong>{dashboard.operations.pendingOrders} pedidos</strong><small>Aguardando pagamento</small></div>
              <ArrowUpRight size={16} />
            </Link>
            <Link href="/admin/produtos?stock=out">
              <span className="is-red"><PackageX size={18} /></span>
              <div><strong>{dashboard.operations.outOfStockCount} produtos</strong><small>Ativos e sem estoque</small></div>
              <ArrowUpRight size={16} />
            </Link>
            <Link href="/admin/prontidao">
              <span className="is-blue"><ReceiptText size={18} /></span>
              <div><strong>{launchSnapshot.actionRequiredCount} verificações</strong><small>Ação necessária para venda</small></div>
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
      </div>

      <div className="admin-dashboard-grid admin-dashboard-grid-tables">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div><span>Comercial</span><h2>Pedidos recentes</h2></div>
            <Link href="/admin/pedidos">Ver todos</Link>
          </div>
          <div className="admin-compact-table-wrap">
            <table className="admin-data-table">
              <thead><tr><th>Pedido</th><th>Cliente</th><th>Status</th><th>Itens</th><th>Total</th></tr></thead>
              <tbody>
                {dashboard.operations.recentOrders.map((order) => (
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
            {!dashboard.operations.recentOrders.length ? <div className="admin-empty-compact">Nenhum pedido registrado.</div> : null}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading"><div><span>Navegação</span><h2>Sessões recentes</h2></div><small>Dados anônimos</small></div>
          <div className="admin-session-list">
            {dashboard.recentSessions.map((session) => (
              <div key={`${session.id}-${session.lastSeenAt}`}>
                <span className="admin-session-device">{session.deviceType.slice(0, 1)}</span>
                <div><strong>{session.id}</strong><small>{session.city}, {session.region} · {session.source}</small></div>
                <div><strong>{session.pageCount}</strong><small>páginas</small></div>
                <time dateTime={session.lastSeenAt}>{dateTimeFormatter.format(new Date(session.lastSeenAt))}</time>
              </div>
            ))}
            {!dashboard.recentSessions.length ? <div className="admin-empty-compact">As novas sessões aparecerão aqui sem exibir IP bruto.</div> : null}
          </div>
        </section>
      </div>

      <section className="admin-panel admin-system-strip">
        <div><span>Catálogo</span><strong>{dashboard.operations.productCount} produtos</strong></div>
        <div><span>Mercado Pago</span><strong className={`is-${paymentSnapshot.status.toLowerCase().replace("_", "-")}`}>{paymentSnapshot.statusLabel}</strong></div>
        <div><span>Prontidão</span><strong>{launchSnapshot.readyCount}/{launchSnapshot.signals.length} verificações</strong></div>
        <div className="admin-system-actions"><Link href="/admin/pagamentos">Pagamentos</Link><Link href="/admin/prontidao">Prontidão</Link></div>
      </section>

      {dashboard.operations.outOfStockProducts.length ? (
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><span>Estoque</span><h2>Itens que precisam de revisão</h2></div><Link href="/admin/produtos?stock=out">Abrir lista</Link></div>
          <div className="admin-out-stock-list">
            {dashboard.operations.outOfStockProducts.map((product) => (
              <Link href={`/admin/produtos/${product.slug}`} key={product.slug}>
                <img src={product.image} alt="" />
                <span><strong>{product.name}</strong><small>{product.brand.name}</small></span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}
