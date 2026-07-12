"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

function metricValue(value: unknown, metric: MetricKey) {
  const number = Number(value) || 0;
  if (metric === "paidRevenueCents") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number / 100);
  }
  return number.toLocaleString("pt-BR");
}

function variationValue(current: number, previous: number | null) {
  if (previous === null) return "Sem dados";
  if (previous === 0 && current > 0) return "Novo";
  if (previous === 0) return "0%";
  const percent = Math.round(((current - previous) / previous) * 1000) / 10;
  return `${percent > 0 ? "+" : ""}${percent.toLocaleString("pt-BR")}%`;
}

export function AdminBusinessTrend({ data, comparisonLabel }: { data: TrendPoint[]; comparisonLabel: string }) {
  const [metric, setMetric] = useState<MetricKey>("visitors");
  const chartData = data.map((point) => ({
    ...point,
    currentValue: point[metric],
    previousValue: point.previous?.[metric] ?? null
  }));

  return (
    <section className="admin-work-surface admin-trend-surface">
      <div className="admin-section-heading admin-section-heading-wrap">
        <div><span>Evolução</span><h2>{metricLabels[metric]}</h2></div>
        <div className="admin-metric-switch" aria-label="Métrica do gráfico">
          {(Object.keys(metricLabels) as MetricKey[]).map((key) => (
            <button className={metric === key ? "is-active" : ""} type="button" onClick={() => setMetric(key)} key={key}>
              {metricLabels[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-chart-key"><span className="is-current">Período atual</span><span className="is-previous">{comparisonLabel}</span></div>
      <div className="admin-business-chart" aria-label={`Evolução de ${metricLabels[metric]}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e7e2e0" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#716966", fontSize: 11 }} minTickGap={18} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#716966", fontSize: 11 }} width={44} allowDecimals={false} />
            <Tooltip
              contentStyle={{ border: "1px solid #dcd6d3", borderRadius: 4, boxShadow: "0 8px 22px rgba(37, 31, 29, .08)", fontSize: 12 }}
              formatter={(value, name) => [metricValue(value, metric), name === "currentValue" ? "Período atual" : comparisonLabel]}
            />
            <Line type="monotone" dataKey="previousValue" stroke="#a9a19e" strokeWidth={1.5} strokeDasharray="5 5" dot={false} connectNulls />
            <Line type="monotone" dataKey="currentValue" stroke="#992a4d" strokeWidth={2.2} dot={{ r: 2.5, fill: "#992a4d" }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="admin-variation-table-wrap">
        <table className="admin-variation-table">
          <thead><tr><th>Período</th><th>Atual</th><th>Comparação</th><th>Diferença</th><th>Variação</th></tr></thead>
          <tbody>
            {chartData.map((point) => {
              const previous = point.previousValue;
              const delta = previous === null ? null : Number(point.currentValue) - Number(previous);
              return (
                <tr key={point.key}>
                  <td>{point.label}</td>
                  <td>{metricValue(point.currentValue, metric)}</td>
                  <td>{previous === null ? "Sem dados" : metricValue(previous, metric)}</td>
                  <td className={delta === null ? "" : delta > 0 ? "is-up" : delta < 0 ? "is-down" : "is-flat"}>
                    {delta === null ? "—" : `${delta > 0 ? "+" : ""}${metricValue(delta, metric)}`}
                  </td>
                  <td className={delta === null ? "" : delta > 0 ? "is-up" : delta < 0 ? "is-down" : "is-flat"}>
                    {variationValue(Number(point.currentValue), previous)}
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
