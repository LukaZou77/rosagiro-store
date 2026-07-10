import Link from "next/link";
import { updateOrderStatusAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { paymentMethodLabel, paymentProviderLabel, paymentStatusLabel } from "@/lib/payments";

const statusLabels: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  FULFILLING: "Em separação",
  SHIPPED: "Enviado",
  CANCELED: "Cancelado"
};

export default async function AdminOrdersPage() {
  const admin = await requireAdmin();
  const orders = await prisma.order.findMany({
    include: { items: true, payment: true },
    orderBy: { createdAt: "desc" },
    take: 80
  });

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Pedidos</p>
        <h1>Pedidos</h1>
        <div className="admin-actions">
          <Link className="button secondary" href="/admin/pedidos/exportar-conversoes" prefetch={false}>
            Exportar conversões pagas
          </Link>
        </div>
      </div>
      <div className="admin-table">
        {orders.map((order) => (
          <article className="admin-order-row" key={order.id}>
            <div>
              <Link href={`/admin/pedidos/${order.orderNumber}`}>
                <strong>{order.orderNumber}</strong>
              </Link>
              <span>{order.customerName}</span>
            </div>
            <div>
              <span>{order.items.length} itens</span>
              <strong>{money(order.totalCents)}</strong>
              <small>
                {paymentProviderLabel(order.payment?.provider)} / {paymentMethodLabel(order.payment?.method)} /{" "}
                {paymentStatusLabel(order.payment?.status)}
              </small>
            </div>
            <form action={updateOrderStatusAction} className="status-form">
              <input type="hidden" name="orderNumber" value={order.orderNumber} />
              <select name="status" defaultValue={order.status}>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button type="submit">Atualizar</button>
            </form>
          </article>
        ))}
        {!orders.length ? (
          <div className="empty-state">
            <strong>Nenhum pedido ainda</strong>
            <p>Quando o checkout simulado for usado, os pedidos aparecem aqui.</p>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
