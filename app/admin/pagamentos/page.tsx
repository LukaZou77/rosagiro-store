import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { money } from "@/lib/money";
import { getPaymentDiagnosticSnapshot, type PaymentDiagnosticStatus } from "@/lib/payment-diagnostics";

function statusClass(status: PaymentDiagnosticStatus) {
  return status.toLowerCase().replace("_", "-");
}

function formatDate(value: Date | null) {
  if (!value) return "Sem registro";
  return value.toLocaleString("pt-BR");
}

function shortValue(value: string | null) {
  if (!value) return "Não registrado";
  if (value.length <= 22) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

export default async function AdminPaymentsPage() {
  const [admin, snapshot] = await Promise.all([requireAdmin(), getPaymentDiagnosticSnapshot()]);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Pagamentos</p>
        <h1>Diagnóstico Mercado Pago sandbox</h1>
        <p>
          Verifique por que Pix/cartão abrem Checkout Pro sandbox ou caem no pagamento simulado. Esta página é somente
          leitura e não mostra token, secret, database URL nem payload completo.
        </p>
        <div className="admin-actions">
          <Link className="button secondary" href="/admin/pedidos">
            Ver pedidos
          </Link>
          <Link className="button secondary" href="/admin/prontidao">
            Ver prontidão
          </Link>
        </div>
      </div>

      <section className={`import-panel payment-diagnostic-hero ${statusClass(snapshot.status)}`}>
        <div className="readiness-group-heading">
          <div>
            <span>Checkout Pro sandbox</span>
            <h2>{snapshot.statusLabel}</h2>
          </div>
          <strong>{snapshot.modeLabel}</strong>
        </div>
        <p className="table-note">{snapshot.fallbackMessage}</p>
        <div className="payment-doc-links">
          <a
            className="button secondary"
            href="https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro/preferences/create-preference/post"
            rel="noreferrer"
            target="_blank"
          >
            Create preference API
          </a>
          <a
            className="button secondary"
            href="https://www.mercadopago.com.br/developers/en/docs/checkout-pro/payment-notifications"
            rel="noreferrer"
            target="_blank"
          >
            Payment notifications
          </a>
        </div>
      </section>

      <div className="metric-grid compact payment-metrics">
        <div>
          <span>Mercado Pago</span>
          <strong>{snapshot.counts.mercadoPagoPayments}</strong>
          <small>payments registrados</small>
        </div>
        <div>
          <span>Simulado</span>
          <strong>{snapshot.counts.simulatedPayments}</strong>
          <small>fallback/local</small>
        </div>
        <div>
          <span>Pendentes</span>
          <strong>{snapshot.counts.pendingPayments}</strong>
          <small>aguardando pagamento</small>
        </div>
        <div>
          <span>Webhooks</span>
          <strong>{snapshot.counts.webhookEvents}</strong>
          <small>{snapshot.counts.invalidWebhookSignatures} assinatura(s) inválida(s)</small>
        </div>
        <div>
          <span>Parcelamento</span>
          <strong>até {snapshot.mercadoPagoMaxInstallments}x</strong>
          <small>Cartão via Checkout Pro</small>
        </div>
      </div>

      <section className="import-panel">
        <div className="readiness-group-heading">
          <div>
            <span>Configuração</span>
            <h2>Checks de sandbox</h2>
          </div>
          <strong>{snapshot.configChecks.filter((item) => item.status === "READY").length}/{snapshot.configChecks.length}</strong>
        </div>
        <div className="readiness-signal-list">
          {snapshot.configChecks.map((item) => (
            <article className={`readiness-signal ${item.status.toLowerCase().replace("_", "-")}`} key={item.key}>
              <span>{item.status === "READY" ? "Pronto" : item.status === "WARNING" ? "Revisar" : "Ação necessária"}</span>
              <strong>{item.label}</strong>
              <small>{item.message}</small>
            </article>
          ))}
        </div>
        <p className="table-note">
          Webhook esperado: <strong>{snapshot.webhookEndpointPath}</strong>. Configure uma URL HTTPS pública antes de testar
          callbacks do Mercado Pago.
        </p>
      </section>

      <section className="import-panel">
        <div className="readiness-group-heading">
          <div>
            <span>Pagamentos recentes</span>
            <h2>Pedidos e provider status</h2>
          </div>
          <strong>{snapshot.recentPayments.length}</strong>
        </div>
        <div className="preview-table-wrap">
          <table className="preview-table payment-diagnostic-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Método</th>
                <th>Status</th>
                <th>Provider</th>
                <th>IDs</th>
                <th>Webhook / erro</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.recentPayments.map((payment) => (
                <tr key={payment.id} className={payment.syncError ? "has-error" : ""}>
                  <td>
                    <Link href={`/admin/pedidos/${payment.orderNumber}`}>
                      <strong>{payment.orderNumber}</strong>
                    </Link>
                    <small>{payment.orderStatus}</small>
                    <small>{money(payment.amountCents)}</small>
                  </td>
                  <td>
                    <strong>{payment.methodLabel}</strong>
                    <small>{payment.providerLabel}</small>
                  </td>
                  <td>
                    <span className={payment.status === "PAID" ? "status-chip success" : "status-chip"}>
                      {payment.statusLabel}
                    </span>
                    <small>{payment.providerStatus || "Sem provider status"}</small>
                    {payment.providerStatusDetail ? <small>{payment.providerStatusDetail}</small> : null}
                  </td>
                  <td>{payment.provider}</td>
                  <td>
                    <small>Preference: {shortValue(payment.providerPreferenceId)}</small>
                    <small>Payment: {shortValue(payment.providerPaymentId)}</small>
                    <small>Ref: {shortValue(payment.providerExternalReference)}</small>
                  </td>
                  <td>
                    <small>{formatDate(payment.lastWebhookAt)}</small>
                    {payment.syncError ? <small>{payment.syncError}</small> : <small>Sem erro de sincronização</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!snapshot.recentPayments.length ? (
          <div className="empty-state">
            <strong>Nenhum pagamento registrado</strong>
            <p>Crie um pedido de teste pelo checkout para ver o resumo aqui.</p>
          </div>
        ) : null}
      </section>

      <section className="import-panel">
        <div className="readiness-group-heading">
          <div>
            <span>Webhooks recentes</span>
            <h2>Eventos desidentificados</h2>
          </div>
          <strong>{snapshot.recentWebhookEvents.length}</strong>
        </div>
        <div className="preview-table-wrap">
          <table className="preview-table payment-diagnostic-table">
            <thead>
              <tr>
                <th>Evento</th>
                <th>Data ID</th>
                <th>Tipo / ação</th>
                <th>Assinatura</th>
                <th>Processamento</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.recentWebhookEvents.map((event) => (
                <tr key={event.id} className={event.signatureValid ? "" : "has-error"}>
                  <td>
                    <strong>{shortValue(event.providerEventId)}</strong>
                    <small>Request: {shortValue(event.requestId)}</small>
                  </td>
                  <td>{shortValue(event.dataId)}</td>
                  <td>
                    <strong>{event.eventType || "Sem tipo"}</strong>
                    <small>{event.action || "Sem ação"}</small>
                  </td>
                  <td>
                    <span className={event.signatureValid ? "status-chip success" : "status-chip warning"}>
                      {event.signatureValid ? "Válida" : "Inválida"}
                    </span>
                  </td>
                  <td>
                    <small>Criado: {formatDate(event.createdAt)}</small>
                    <small>Processado: {formatDate(event.processedAt)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!snapshot.recentWebhookEvents.length ? (
          <div className="empty-state">
            <strong>Nenhum webhook recebido</strong>
            <p>Isso é esperado enquanto a loja estiver local ou sem URL HTTPS pública.</p>
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
