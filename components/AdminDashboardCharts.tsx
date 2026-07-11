"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type TrendPoint = {
  date: string;
  label: string;
  visitors: number;
  pageViews: number;
  orders: number;
  revenueCents: number;
};

const tooltipStyle = {
  border: "1px solid #e7dfe1",
  borderRadius: 8,
  boxShadow: "0 12px 34px rgba(42, 27, 31, 0.12)",
  fontSize: 12
};

export function AdminDashboardCharts({ data }: { data: TrendPoint[] }) {
  return (
    <div className="admin-dashboard-grid admin-dashboard-grid-charts">
      <section className="admin-panel admin-chart-panel">
        <div className="admin-panel-heading">
          <div><span>Audiência</span><h2>Visitantes e páginas</h2></div>
          <div className="admin-chart-legend"><span className="is-burgundy">Visitantes</span><span className="is-blue">Páginas</span></div>
        </div>
        <div className="admin-chart-canvas" aria-label="Gráfico de visitantes e páginas">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="visitorFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9f294d" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#9f294d" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#eee8e9" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#75696c", fontSize: 11 }} minTickGap={18} />
              <YAxis yAxisId="orders" axisLine={false} tickLine={false} tick={{ fill: "#75696c", fontSize: 11 }} allowDecimals={false} />
              <YAxis yAxisId="revenue" orientation="right" hide />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#2d2527", fontWeight: 700 }} />
              <Area type="monotone" dataKey="pageViews" name="Páginas" stroke="#527da5" strokeWidth={2} fillOpacity={0} />
              <Area type="monotone" dataKey="visitors" name="Visitantes" stroke="#9f294d" strokeWidth={2.3} fill="url(#visitorFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="admin-panel admin-chart-panel">
        <div className="admin-panel-heading">
          <div><span>Vendas</span><h2>Pedidos e receita paga</h2></div>
          <div className="admin-chart-legend"><span className="is-orange">Pedidos</span><span className="is-green">Receita</span></div>
        </div>
        <div className="admin-chart-canvas" aria-label="Gráfico de pedidos e receita">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#eee8e9" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#75696c", fontSize: 11 }} minTickGap={18} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#75696c", fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: "#2d2527", fontWeight: 700 }}
                formatter={(value, name) => name === "Receita" ? [`R$ ${(Number(value) / 100).toFixed(2).replace(".", ",")}`, name] : [value, name]}
              />
              <Bar yAxisId="orders" dataKey="orders" name="Pedidos" fill="#d9822b" radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar yAxisId="revenue" dataKey="revenueCents" name="Receita" fill="#4d8b68" radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
