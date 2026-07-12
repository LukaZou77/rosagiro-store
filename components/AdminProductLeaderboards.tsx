"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useAdminLanguage } from "@/components/AdminLanguageProvider";

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

const metricLabelsZh: Record<MetricKey, string> = {
  views: "浏览最多",
  addToCartQuantity: "加购最多",
  orderedUnits: "下单件数",
  orderCount: "订单最多",
  paidUnits: "成交件数",
  paidRevenueCents: "成交额最高"
};

function formatMetric(row: ProductRow, metric: MetricKey, locale: string) {
  if (metric === "paidRevenueCents") {
    return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(row[metric] / 100);
  }
  return row[metric].toLocaleString(locale);
}

export function AdminProductLeaderboards({ leaderboards, compact = false }: { leaderboards: Record<MetricKey, ProductRow[]>; compact?: boolean }) {
  const { locale, t } = useAdminLanguage();
  const [metric, setMetric] = useState<MetricKey>("views");
  const labels = locale === "zh-CN" ? metricLabelsZh : metricLabels;
  const rows = leaderboards[metric].slice(0, compact ? 5 : 10);

  return (
    <section className="admin-work-surface admin-product-leaderboard">
      <div className="admin-section-heading admin-section-heading-wrap">
        <div><span>{t("Produtos", "商品")}</span><h2>{t("Desempenho por produto", "商品表现排行")}</h2></div>
        <div className="admin-metric-switch" aria-label={t("Classificação de produtos", "商品排行榜指标")}>
          {(Object.keys(metricLabels) as MetricKey[]).map((key) => (
            <button className={metric === key ? "is-active" : ""} type="button" onClick={() => setMetric(key)} key={key}>{labels[key]}</button>
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
              {row.rank === 1 ? <span className="admin-leader-badge">{metric === "views" ? t("Mais visto", "浏览冠军") : metric === "orderCount" || metric === "orderedUnits" ? t("Mais pedido", "下单冠军") : t("Líder", "榜首")}</span> : null}
              <strong className="admin-leaderboard-value">{formatMetric(row, metric, locale)}</strong>
              <span className={`admin-rank-change ${row.rankChange === null ? "is-new" : row.rankChange > 0 ? "is-up" : row.rankChange < 0 ? "is-down" : "is-flat"}`}>
                {row.rankChange === null ? t("Novo", "新增") : row.rankChange > 0 ? <><ArrowUp size={13} />{row.rankChange}</> : row.rankChange < 0 ? <><ArrowDown size={13} />{Math.abs(row.rankChange)}</> : <Minus size={13} />}
              </span>
            </div>
          ))}
        </div>
      ) : <div className="admin-empty-compact">{t("Ainda não há dados para esta classificação.", "该排行榜暂无数据。")}</div>}
    </section>
  );
}
