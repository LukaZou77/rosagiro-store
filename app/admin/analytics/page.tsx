import Link from "next/link";
import { AdminBusinessTrend } from "@/components/AdminBusinessTrend";
import { AdminProductLeaderboards } from "@/components/AdminProductLeaderboards";
import { AdminShell } from "@/components/AdminShell";
import { getAdminBusinessAnalytics, type BusinessMetricKey } from "@/lib/admin-business-analytics";
import { createAdminTranslator } from "@/lib/admin-i18n";
import { getAdminLocale } from "@/lib/admin-i18n-server";
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

const metricLabelsZh: Record<BusinessMetricKey, string> = {
  visitors: "访客",
  pageViews: "浏览量",
  createdOrders: "创建订单",
  paidOrders: "已付款订单",
  paidRevenueCents: "已付款收入",
  whatsappSessions: "WhatsApp 点击会话",
  qualifiedLeads: "有效询盘"
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function metricValue(key: BusinessMetricKey, value: number, locale = "pt-BR") {
  return key === "paidRevenueCents" ? money(value) : value.toLocaleString(locale);
}

function variationLabel(state: string, percent: number | null, locale: string, t: (pt: string, zh: string) => string) {
  if (state === "no_data") return t("Sem dados comparáveis", "暂无可比数据");
  if (state === "new") return t("Novo no período", "本周期新增");
  if (percent === null) return "—";
  return `${percent > 0 ? "+" : ""}${percent.toLocaleString(locale)}%`;
}

export default async function AdminAnalyticsPage({ searchParams }: PageProps) {
  const [admin, params, locale] = await Promise.all([requireAdmin(), searchParams, getAdminLocale()]);
  const t = createAdminTranslator(locale);
  const analytics = await getAdminBusinessAnalytics(single(params.period), single(params.compare));
  const periodLabel = analytics.period === "today"
    ? t("Hoje", "今日")
    : analytics.period === "week"
      ? t("Semana", "本周")
      : analytics.period === "month"
        ? t("Mês", "本月")
        : t("Ano", "本年");
  const comparisonLabel = analytics.comparison === "previous_year"
    ? t("Mesmo período do ano anterior", "去年同期")
    : t("Período anterior", "上一周期");

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">{t("Relatórios", "经营报表")}</p>
          <h1>{t("Desempenho da operação", "经营表现")}</h1>
          <p>{t("Audiência, pedidos, receita paga, WhatsApp e produtos em uma única leitura.", "集中查看访客、订单、已付款收入、WhatsApp 询盘和商品表现。")}</p>
        </div>
        <div className="admin-heading-actions"><Link className="button secondary" href="/admin/leads" prefetch={false}>{t("Leads", "询盘")}</Link><Link className="button primary" href="/admin/pedidos" prefetch={false}>{t("Pedidos", "订单")}</Link></div>
      </div>

      {!analytics.available ? <div className="admin-notice warning" role="status">{t("Os relatórios estão temporariamente indisponíveis. Tente novamente em instantes.", "报表暂时不可用，请稍后重试。")}</div> : null}

      <div className="admin-analytics-toolbar">
        <nav className="admin-period-tabs" aria-label={t("Período do relatório", "报表统计周期")}>
          {([['today', t('Hoje', '今日')], ['week', t('Semana', '本周')], ['month', t('Mês', '本月')], ['year', t('Ano', '本年')]] as const).map(([value, label]) => (
            <Link className={analytics.period === value ? "is-active" : ""} href={`/admin/analytics?period=${value}&compare=${analytics.comparison}`} prefetch={false} key={value}>{label}</Link>
          ))}
        </nav>
        <form action="/admin/analytics" className="admin-comparison-control">
          <input type="hidden" name="period" value={analytics.period} />
          <label>{t("Comparar com", "对比范围")}<select name="compare" defaultValue={analytics.comparison}><option value="previous_period">{t("Período anterior", "上一周期")}</option><option value="previous_year">{t("Mesmo período do ano anterior", "去年同期")}</option></select></label>
          <button type="submit">{t("Aplicar", "应用")}</button>
        </form>
      </div>

      <section className="admin-metric-strip" aria-label={t("Resumo do relatório", "报表摘要")}>
        {(Object.keys(metricLabels) as BusinessMetricKey[]).map((key) => {
          const metric = analytics.kpis[key];
          return (
            <div key={key}>
              <span>{locale === "zh-CN" ? metricLabelsZh[key] : metricLabels[key]}</span>
              <strong>{metricValue(key, metric.current, locale)}</strong>
              <small>{periodLabel}</small>
              <span className={`admin-change is-${metric.state}`}>{variationLabel(metric.state, metric.percent, locale, t)}</span>
            </div>
          );
        })}
      </section>

      <AdminBusinessTrend data={analytics.trend} comparisonLabel={comparisonLabel} />

      <div className="admin-insight-grid admin-report-insights">
        <section className="admin-work-surface admin-funnel-summary">
          <div className="admin-section-heading"><div><span>WhatsApp</span><h2>{t("Consultas e qualificação", "询盘与有效线索")}</h2></div></div>
          <div><span>{t("Cliques totais", "总点击数")}</span><strong>{analytics.current.whatsappClicks}</strong><small>{t("Saídas registradas no site", "网站记录的跳转次数")}</small></div>
          <div><span>{t("Sessões com clique", "发生点击的会话")}</span><strong>{analytics.current.whatsappSessions}</strong><small>{t("Visitantes com intenção", "有咨询意向的访客")}</small></div>
          <div><span>{t("Leads qualificados", "有效询盘")}</span><strong>{analytics.current.qualifiedLeads}</strong><small>{t("Conversas reais registradas", "已登记的真实沟通")}</small></div>
          <div><span>{t("Taxa clique → lead", "点击 → 询盘转化率")}</span><strong>{analytics.funnel.whatsappClickToLeadRate === null ? "—" : `${analytics.funnel.whatsappClickToLeadRate}%`}</strong><small>{t("Clique não equivale a conversa", "点击不等于真实沟通")}</small></div>
        </section>

        <section className="admin-work-surface admin-comparison-summary">
          <div className="admin-section-heading"><div><span>{t("Comparação", "对比")}</span><h2>{t("Variação consolidada", "综合变化")}</h2></div><small>{comparisonLabel}</small></div>
          <div className="admin-compact-table-wrap">
            <table>
              <thead><tr><th>{t("Métrica", "指标")}</th><th>{t("Atual", "当前")}</th><th>{t("Comparação", "对比")}</th><th>{t("Diferença", "差值")}</th><th>{t("Variação", "变化")}</th></tr></thead>
              <tbody>
                {(Object.keys(metricLabels) as BusinessMetricKey[]).map((key) => {
                  const metric = analytics.kpis[key];
                  return <tr key={key}><td>{locale === "zh-CN" ? metricLabelsZh[key] : metricLabels[key]}</td><td>{metricValue(key, metric.current, locale)}</td><td>{metricValue(key, metric.previous, locale)}</td><td className={`is-${metric.state}`}>{metric.delta > 0 ? "+" : ""}{metricValue(key, metric.delta, locale)}</td><td className={`is-${metric.state}`}>{variationLabel(metric.state, metric.percent, locale, t)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <AdminProductLeaderboards leaderboards={analytics.leaderboards} />

      <div className="admin-method-note">
        <strong>{t("Como os números são calculados", "统计口径")}</strong>
        <p>{t("Receita e vendas usam apenas pagamentos aprovados. Pedidos criados, cliques no WhatsApp e leads qualificados permanecem indicadores separados. Quando não existe base comparável, o relatório não inventa porcentagem.", "收入和成交仅统计已批准付款。创建订单、WhatsApp 点击和有效询盘分别统计；没有可比基数时不会虚构百分比。")}</p>
      </div>
    </AdminShell>
  );
}
