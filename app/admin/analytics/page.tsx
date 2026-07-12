import Link from "next/link";
import { AdminBusinessTrend } from "@/components/AdminBusinessTrend";
import { AdminProductLeaderboards } from "@/components/AdminProductLeaderboards";
import { AdminShell } from "@/components/AdminShell";
import { getAdminBusinessAnalytics, type BusinessMetricKey } from "@/lib/admin-business-analytics";
import { requireAdmin } from "@/lib/auth";
import { money } from "@/lib/money";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const metricLabels: Record<BusinessMetricKey, string> = {
  visitors: "Visitantes",
  pageViews: "Visualizações",
  createdOrders: "Pedidos criados",
  paidOrders: "Pedidos pagos",
  paidRevenueCents: "Receita paga",
  whatsappSessions: "Sessões com WhatsApp",
  qualifiedLeads: "Leads qualificados"
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function metricValue(key: BusinessMetricKey, value: number) {
  return key === "paidRevenueCents" ? money(value) : value.toLocaleString("pt-BR");
}

function variationLabel(state: string, percent: number | null) {
  if (state === "no_data") return "Sem dados comparáveis";
  if (state === "new") return "Novo no período";
  if (percent === null) return "—";
  return `${percent > 0 ? "+" : ""}${percent.toLocaleString("pt-BR")}%`;
}

export default async function AdminAnalyticsPage({ searchParams }: PageProps) {
  const [admin, params] = await Promise.all([requireAdmin(), searchParams]);
  const analytics = await getAdminBusinessAnalytics(single(params.period), single(params.compare));

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Relatórios</p>
          <h1>Desempenho da operação</h1>
          <p>Audiência, pedidos, receita paga, WhatsApp e produtos em uma única leitura.</p>
        </div>
        <div className="admin-heading-actions"><Link className="button secondary" href="/admin/leads">Leads</Link><Link className="button primary" href="/admin/pedidos">Pedidos</Link></div>
      </div>

      <div className="admin-analytics-toolbar">
        <nav className="admin-period-tabs" aria-label="Período do relatório">
          {([['today', 'Hoje'], ['week', 'Semana'], ['month', 'Mês'], ['year', 'Ano']] as const).map(([value, label]) => (
            <Link className={analytics.period === value ? "is-active" : ""} href={`/admin/analytics?period=${value}&compare=${analytics.comparison}`} key={value}>{label}</Link>
          ))}
        </nav>
        <form action="/admin/analytics" className="admin-comparison-control">
          <input type="hidden" name="period" value={analytics.period} />
          <label>Comparar com<select name="compare" defaultValue={analytics.comparison}><option value="previous_period">Período anterior</option><option value="previous_year">Mesmo período do ano anterior</option></select></label>
          <button type="submit">Aplicar</button>
        </form>
      </div>

      <section className="admin-metric-strip" aria-label="Resumo do relatório">
        {(Object.keys(metricLabels) as BusinessMetricKey[]).map((key) => {
          const metric = analytics.kpis[key];
          return (
            <div key={key}>
              <span>{metricLabels[key]}</span>
              <strong>{metricValue(key, metric.current)}</strong>
              <small>{analytics.periodLabel}</small>
              <span className={`admin-change is-${metric.state}`}>{variationLabel(metric.state, metric.percent)}</span>
            </div>
          );
        })}
      </section>

      <AdminBusinessTrend data={analytics.trend} comparisonLabel={analytics.comparisonLabel} />

      <div className="admin-insight-grid admin-report-insights">
        <section className="admin-work-surface admin-funnel-summary">
          <div className="admin-section-heading"><div><span>WhatsApp</span><h2>Consultas e qualificação</h2></div></div>
          <div><span>Cliques totais</span><strong>{analytics.current.whatsappClicks}</strong><small>Saídas registradas no site</small></div>
          <div><span>Sessões com clique</span><strong>{analytics.current.whatsappSessions}</strong><small>Visitantes com intenção</small></div>
          <div><span>Leads qualificados</span><strong>{analytics.current.qualifiedLeads}</strong><small>Conversas reais registradas</small></div>
          <div><span>Taxa clique → lead</span><strong>{analytics.funnel.whatsappClickToLeadRate === null ? "—" : `${analytics.funnel.whatsappClickToLeadRate}%`}</strong><small>Clique não equivale a conversa</small></div>
        </section>

        <section className="admin-work-surface admin-comparison-summary">
          <div className="admin-section-heading"><div><span>Comparação</span><h2>Variação consolidada</h2></div><small>{analytics.comparisonLabel}</small></div>
          <div className="admin-compact-table-wrap">
            <table>
              <thead><tr><th>Métrica</th><th>Atual</th><th>Comparação</th><th>Diferença</th><th>Variação</th></tr></thead>
              <tbody>
                {(Object.keys(metricLabels) as BusinessMetricKey[]).map((key) => {
                  const metric = analytics.kpis[key];
                  return <tr key={key}><td>{metricLabels[key]}</td><td>{metricValue(key, metric.current)}</td><td>{metricValue(key, metric.previous)}</td><td className={`is-${metric.state}`}>{metric.delta > 0 ? "+" : ""}{metricValue(key, metric.delta)}</td><td className={`is-${metric.state}`}>{variationLabel(metric.state, metric.percent)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <AdminProductLeaderboards leaderboards={analytics.leaderboards} />

      <div className="admin-method-note">
        <strong>Como os números são calculados</strong>
        <p>Receita e vendas usam apenas pagamentos aprovados. Pedidos criados, cliques no WhatsApp e leads qualificados permanecem indicadores separados. Quando não existe base comparável, o relatório não inventa porcentagem.</p>
      </div>
    </AdminShell>
  );
}
