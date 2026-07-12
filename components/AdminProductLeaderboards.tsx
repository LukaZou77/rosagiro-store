"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

type MetricKey = "views" | "addToCartQuantity" | "orderedUnits" | "orderCount" | "paidUnits" | "paidRevenueCents";

type ProductRow = {
  productKey: string;
  productSlug: string;
  productName: string;
  brandName: string;
  categoryName: string;
  image: string;
  views: number;
  addToCartQuantity: number;
  orderedUnits: number;
  orderCount: number;
  paidUnits: number;
  paidRevenueCents: number;
  rank: number;
  previousRank: number | null;
  rankChange: number | null;
};

const metricLabels: Record<MetricKey, string> = {
  views: "Mais vistos",
  addToCartQuantity: "Mais adicionados",
  orderedUnits: "Unidades pedidas",
  orderCount: "Mais pedidos",
  paidUnits: "Mais vendidos",
  paidRevenueCents: "Maior receita"
};

function formatMetric(row: ProductRow, metric: MetricKey) {
  if (metric === "paidRevenueCents") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(row[metric] / 100);
  }
  return row[metric].toLocaleString("pt-BR");
}

export function AdminProductLeaderboards({ leaderboards, compact = false }: { leaderboards: Record<MetricKey, ProductRow[]>; compact?: boolean }) {
  const [metric, setMetric] = useState<MetricKey>("views");
  const rows = leaderboards[metric].slice(0, compact ? 5 : 10);

  return (
    <section className="admin-work-surface admin-product-leaderboard">
      <div className="admin-section-heading admin-section-heading-wrap">
        <div><span>Produtos</span><h2>Desempenho por produto</h2></div>
        <div className="admin-metric-switch" aria-label="Classificação de produtos">
          {(Object.keys(metricLabels) as MetricKey[]).map((key) => (
            <button className={metric === key ? "is-active" : ""} type="button" onClick={() => setMetric(key)} key={key}>{metricLabels[key]}</button>
          ))}
        </div>
      </div>
      {rows.length ? (
        <div className="admin-leaderboard-list">
          {rows.map((row) => (
            <div className="admin-leaderboard-row" key={`${metric}-${row.productKey}`}>
              <strong className="admin-leaderboard-rank">{String(row.rank).padStart(2, "0")}</strong>
              <Image alt="" src={row.image} width={44} height={44} />
              <div className="admin-leaderboard-product">
                <Link href={`/admin/produtos/${row.productSlug}`} prefetch={false}>{row.productName}</Link>
                <small>{row.brandName} · {row.categoryName}</small>
              </div>
              {row.rank === 1 ? <span className="admin-leader-badge">{metric === "views" ? "Mais visto" : metric === "orderCount" || metric === "orderedUnits" ? "Mais pedido" : "Líder"}</span> : null}
              <strong className="admin-leaderboard-value">{formatMetric(row, metric)}</strong>
              <span className={`admin-rank-change ${row.rankChange === null ? "is-new" : row.rankChange > 0 ? "is-up" : row.rankChange < 0 ? "is-down" : "is-flat"}`}>
                {row.rankChange === null ? "Novo" : row.rankChange > 0 ? <><ArrowUp size={13} />{row.rankChange}</> : row.rankChange < 0 ? <><ArrowDown size={13} />{Math.abs(row.rankChange)}</> : <Minus size={13} />}
              </span>
            </div>
          ))}
        </div>
      ) : <div className="admin-empty-compact">Ainda não há dados para esta classificação.</div>}
    </section>
  );
}
