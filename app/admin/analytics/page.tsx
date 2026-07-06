import Image from "next/image";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { getProductAnalyticsDashboard, normalizeAnalyticsRange } from "@/lib/product-analytics";
import { money } from "@/lib/money";

type PageProps = {
  searchParams: Promise<{ range?: string }>;
};

function percent(numerator: number, denominator: number) {
  if (!denominator) return "0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export default async function AdminAnalyticsPage({ searchParams }: PageProps) {
  const [admin, params] = await Promise.all([requireAdmin(), searchParams]);
  const range = normalizeAnalyticsRange(params.range);
  const dashboard = await getProductAnalyticsDashboard(range);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Dados</p>
        <h1>Dados de produtos</h1>
        <p>Visualizacoes, carrinho e vendas pagas por produto.</p>
      </div>

      <form className="filters admin-filters analytics-range-filter" action="/admin/analytics">
        <label>
          Periodo
          <select name="range" defaultValue={range}>
            <option value="7d">Ultimos 7 dias</option>
            <option value="30d">Ultimos 30 dias</option>
            <option value="90d">Ultimos 90 dias</option>
          </select>
        </label>
        <button className="button primary" type="submit">
          Aplicar
        </button>
      </form>

      <section className="metric-grid compact">
        <div>
          <span>Visualizacoes</span>
          <strong>{dashboard.totals.views}</strong>
        </div>
        <div>
          <span>Adicoes ao carrinho</span>
          <strong>{dashboard.totals.addToCartQuantity}</strong>
        </div>
        <div>
          <span>Unidades pagas</span>
          <strong>{dashboard.totals.paidUnits}</strong>
        </div>
        <div>
          <span>Receita paga</span>
          <strong>{money(dashboard.totals.revenueCents)}</strong>
        </div>
      </section>

      <section className="import-panel">
        <div className="product-gallery-heading">
          <div>
            <strong>Desempenho por produto</strong>
            <small>Vendas sao calculadas apenas por pedidos pagos; visualizacoes e carrinho sao eventos anonimos.</small>
          </div>
        </div>

        {dashboard.rows.length ? (
          <div className="analytics-table-scroll">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Marca</th>
                  <th>Uso</th>
                  <th>Views</th>
                  <th>Carrinho</th>
                  <th>Vendas</th>
                  <th>Receita</th>
                  <th>Carrinho / view</th>
                  <th>Venda / view</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.rows.map((row) => (
                  <tr key={row.productId}>
                    <td>
                      <div className="analytics-product-cell">
                        <Image alt="" height={48} src={row.image} width={48} />
                        <Link href={`/admin/produtos/${row.slug}`}>{row.name}</Link>
                      </div>
                    </td>
                    <td>{row.brand}</td>
                    <td>{row.category}</td>
                    <td>{row.views}</td>
                    <td>{row.addToCartQuantity}</td>
                    <td>{row.paidUnits}</td>
                    <td>{money(row.revenueCents)}</td>
                    <td>{percent(row.addToCartQuantity, row.views)}</td>
                    <td>{percent(row.paidUnits, row.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <strong>Sem dados neste periodo</strong>
            <p>Os dados aparecem depois que clientes abrirem produtos, adicionarem ao carrinho ou pagarem pedidos.</p>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
