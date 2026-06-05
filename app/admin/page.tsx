import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLaunchReadinessSnapshot, launchReadinessSignalLabels } from "@/lib/launch-readiness";
import { money } from "@/lib/money";
import { getPaymentDiagnosticSnapshot } from "@/lib/payment-diagnostics";

export default async function AdminPage() {
  const admin = await requireAdmin();
  const [productCount, pendingOrders, paidOrders, revenue, launchSnapshot, paymentSnapshot] = await Promise.all([
    prisma.product.count(),
    prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
    prisma.order.count({ where: { status: "PAID" } }),
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { totalCents: true } }),
    getLaunchReadinessSnapshot(),
    getPaymentDiagnosticSnapshot()
  ]);
  const topIssues = launchSnapshot.highPriorityIssues.slice(0, 3);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Resumo</p>
        <h1>Operação RosaGiro</h1>
      </div>
      <div className="metric-grid">
        <Link href="/admin/produtos">
          <span>Produtos</span>
          <strong>{productCount}</strong>
        </Link>
        <Link href="/admin/pedidos">
          <span>Pedidos pendentes</span>
          <strong>{pendingOrders}</strong>
        </Link>
        <Link href="/admin/pedidos">
          <span>Pedidos pagos</span>
          <strong>{paidOrders}</strong>
        </Link>
        <div>
          <span>Receita simulada</span>
          <strong>{money(revenue._sum.totalCents || 0)}</strong>
        </div>
      </div>

      <section className={`import-panel payment-diagnostic-hero ${paymentSnapshot.status.toLowerCase().replace("_", "-")}`}>
        <div className="readiness-group-heading">
          <div>
            <span>Pagamentos</span>
            <h2>Mercado Pago sandbox</h2>
          </div>
          <strong>{paymentSnapshot.statusLabel}</strong>
        </div>
        <p className="table-note">{paymentSnapshot.fallbackMessage}</p>
        <div className="admin-actions">
          <Link className="button primary" href="/admin/pagamentos">
            Abrir diagnóstico
          </Link>
          <Link className="button secondary" href="/checkout">
            Testar checkout
          </Link>
        </div>
      </section>

      <section className="import-panel launch-summary">
        <div className="readiness-group-heading">
          <div>
            <span>Prontidão para venda real</span>
            <h2>Saúde de lançamento</h2>
          </div>
          <strong>
            {launchSnapshot.readyCount}/{launchSnapshot.signals.length}
          </strong>
        </div>
        <div className="launch-summary-grid">
          <div>
            <span>Prontos</span>
            <strong>{launchSnapshot.readyCount}</strong>
          </div>
          <div>
            <span>Para revisar</span>
            <strong>{launchSnapshot.warningCount}</strong>
          </div>
          <div>
            <span>Ação necessária</span>
            <strong>{launchSnapshot.actionRequiredCount}</strong>
          </div>
        </div>
        {topIssues.length ? (
          <div className="readiness-signal-list compact">
            {topIssues.map((signal) => (
              <Link className={`readiness-signal ${signal.status.toLowerCase().replace("_", "-")}`} href={signal.actionHref} key={signal.key}>
                <span>{launchReadinessSignalLabels[signal.status]}</span>
                <strong>{signal.label}</strong>
                <small>{signal.message}</small>
              </Link>
            ))}
          </div>
        ) : (
          <div className="admin-notice success">Nenhum bloqueio alto detectado pelos checks automáticos.</div>
        )}
        <div className="admin-actions">
          <Link className="button primary" href="/admin/prontidao">
            Ver central de lacunas
          </Link>
          <Link className="button secondary" href="/admin/loja">
            Revisar dados da loja
          </Link>
        </div>
      </section>
    </AdminShell>
  );
}
