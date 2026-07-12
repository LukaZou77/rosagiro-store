"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAdminLanguage } from "@/components/AdminLanguageProvider";

type MetricKey =
  | "visitors"
  | "pageViews"
  | "createdOrders"
  | "paidOrders"
  | "paidRevenueCents"
  | "whatsappSessions"
  | "qualifiedLeads";

type TrendPoint = {
  key: string;
  label: string;
  visitors: number;
  pageViews: number;
  createdOrders: number;
  paidOrders: number;
  paidRevenueCents: number;
  whatsappSessions: number;
  qualifiedLeads: number;
  previous: null | {
    visitors: number;
    pageViews: number;
    createdOrders: number;
    paidOrders: number;
    paidRevenueCents: number;
    whatsappSessions: number;
    qualifiedLeads: number;
  };
};

const metricLabels: Record<MetricKey, string> = {
  visitors: "Visitantes",
  pageViews: "Visualizações",
  createdOrders: "Pedidos criados",
  paidOrders: "Pedidos pagos",
  paidRevenueCents: "Receita paga",
  whatsappSessions: "WhatsApp",
  qualifiedLeads: "Leads qualificados"
};

const metricLabelsZh: Record<MetricKey, string> = {
  visitors: "访客",
  pageViews: "浏览量",
  createdOrders: "创建订单",
  paidOrders: "已付款订单",
  paidRevenueCents: "已付款收入",
  whatsappSessions: "WhatsApp 点击会话",
  qualifiedLeads: "有效询盘"
};

function metricValue(value: unknown, metric: MetricKey, locale: string) {
  const number = Number(value) || 0;
  if (metric === "paidRevenueCents") {
    return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(number / 100);
  }
  return number.toLocaleString(locale);
}

function variationValue(current: number, previous: number | null, locale: string, t: (pt: string, zh: string) => string) {
  if (previous === null) return t("Sem dados", "暂无数据");
  if (previous === 0 && current > 0) return t("Novo", "新增");
  if (previous === 0) return "0%";
  const percent = Math.round(((current - previous) / previous) * 1000) / 10;
  return `${percent > 0 ? "+" : ""}${percent.toLocaleString(locale)}%`;
}

export function AdminBusinessTrend({ data, comparisonLabel }: { data: TrendPoint[]; comparisonLabel: string }) {
  const { locale, t } = useAdminLanguage();
  const [metric, setMetric] = useState<MetricKey>("visitors");
  const labels = locale === "zh-CN" ? metricLabelsZh : metricLabels;
  const chartData = data.map((point) => ({
    ...point,
    currentValue: point[metric],
    previousValue: point.previous?.[metric] ?? null
  }));

  return (
    <section className="admin-work-surface admin-trend-surface">
      <div className="admin-section-heading admin-section-heading-wrap">
        <div><span>{t("Evolução", "趋势")}</span><h2>{labels[metric]}</h2></div>
        <div className="admin-metric-switch" aria-label={t("Métrica do gráfico", "图表指标")}>
          {(Object.keys(metricLabels) as MetricKey[]).map((key) => (
            <button className={metric === key ? "is-active" : ""} type="button" onClick={() => setMetric(key)} key={key}>
              {labels[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-chart-key"><span className="is-current">{t("Período atual", "当前周期")}</span><span className="is-previous">{comparisonLabel}</span></div>
      <div className="admin-business-chart" aria-label={t(`Evolução de ${metricLabels[metric]}`, `${labels[metric]}趋势`)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e7e2e0" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#716966", fontSize: 11 }} minTickGap={18} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#716966", fontSize: 11 }} width={44} allowDecimals={false} />
            <Tooltip
              contentStyle={{ border: "1px solid #dcd6d3", borderRadius: 4, boxShadow: "0 8px 22px rgba(37, 31, 29, .08)", fontSize: 12 }}
              formatter={(value, name) => [metricValue(value, metric, locale), name === "currentValue" ? t("Período atual", "当前周期") : comparisonLabel]}
            />
            <Line type="monotone" dataKey="previousValue" stroke="#a9a19e" strokeWidth={1.5} strokeDasharray="5 5" dot={false} connectNulls />
            <Line type="monotone" dataKey="currentValue" stroke="#992a4d" strokeWidth={2.2} dot={{ r: 2.5, fill: "#992a4d" }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="admin-variation-table-wrap">
        <table className="admin-variation-table">
          <thead><tr><th>{t("Período", "周期")}</th><th>{t("Atual", "当前")}</th><th>{t("Comparação", "对比")}</th><th>{t("Diferença", "差值")}</th><th>{t("Variação", "变化")}</th></tr></thead>
          <tbody>
            {chartData.map((point) => {
              const previous = point.previousValue;
              const delta = previous === null ? null : Number(point.currentValue) - Number(previous);
              return (
                <tr key={point.key}>
                  <td>{point.label}</td>
                  <td>{metricValue(point.currentValue, metric, locale)}</td>
                  <td>{previous === null ? t("Sem dados", "暂无数据") : metricValue(previous, metric, locale)}</td>
                  <td className={delta === null ? "" : delta > 0 ? "is-up" : delta < 0 ? "is-down" : "is-flat"}>
                    {delta === null ? "—" : `${delta > 0 ? "+" : ""}${metricValue(delta, metric, locale)}`}
                  </td>
                  <td className={delta === null ? "" : delta > 0 ? "is-up" : delta < 0 ? "is-down" : "is-flat"}>
                    {variationValue(Number(point.currentValue), previous, locale, t)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
