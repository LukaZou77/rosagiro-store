import { notFound } from "next/navigation";
import { updateOrderStatusAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { paymentMethodLabel } from "@/lib/payments";

const statusLabels: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  FULFILLING: "Em separacao",
  SHIPPED: "Enviado",
  CANCELED: "Cancelado"
};

const addressMatchLabels: Record<string, string> = {
  VALIDATED: "Validado",
  NEEDS_REVIEW: "Conferir manualmente",
  FAILED: "Falhou",
  DISABLED: "Nao configurado",
  NOT_CHECKED: "Nao checado"
};

type PageProps = {
  params: Promise<{ orderNumber: string }>;
};

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const admin = await requireAdmin();
  const { orderNumber } = await params;
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true, payment: true }
  });
  if (!order) notFound();

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Pedido</p>
        <h1>{order.orderNumber}</h1>
      </div>
      <section className="admin-detail-grid">
        <div className="cart-panel">
          <h2>Cliente</h2>
          <p>{order.customerName}</p>
          <p>{order.customerEmail}</p>
          <p>{order.customerPhone} / CPF {order.customerCpf}</p>
          <p>
            {order.street}, {order.number} {order.complement ? `- ${order.complement}` : ""}
          </p>
          <p>
            {order.district}, {order.city} - {order.state}, CEP {order.cep}
          </p>
          <div className={`address-match-card admin ${order.addressMatchStatus.toLowerCase().replace("_", "-")}`}>
            <span>{addressMatchLabels[order.addressMatchStatus] || order.addressMatchStatus}</span>
            <strong>{order.addressMatchFormatted || "Endereco salvo sem padronizacao externa"}</strong>
            <small>{order.addressMatchMessage || "Confira antes do envio."}</small>
            {order.addressLatitude !== null && order.addressLongitude !== null ? (
              <small>
                Coordenadas: {order.addressLatitude.toFixed(6)}, {order.addressLongitude.toFixed(6)}
              </small>
            ) : null}
            {order.addressMatchPlaceId ? <small>Place ID: {order.addressMatchPlaceId}</small> : null}
            {order.addressMatchGranularity ? <small>Granularidade: {order.addressMatchGranularity}</small> : null}
          </div>
        </div>
        <div className="summary-panel">
          <h2>Status</h2>
          <form action={updateOrderStatusAction} className="status-form detail-status-form">
            <input type="hidden" name="orderNumber" value={order.orderNumber} />
            <select name="status" defaultValue={order.status}>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
            <button className="button primary" type="submit">
              Atualizar status
            </button>
          </form>
          <div className="summary-block">
            <div>
              <span>Pagamento</span>
              <strong>{paymentMethodLabel(order.payment?.method)}</strong>
            </div>
            <div>
              <span>Subtotal</span>
              <strong>{money(order.subtotalCents)}</strong>
            </div>
            <div>
              <span>Desconto</span>
              <strong>-{money(order.discountCents)}</strong>
            </div>
            <div>
              <span>Frete</span>
              <strong>{money(order.shippingCents)}</strong>
            </div>
            <div>
              <span>Metodo</span>
              <strong>{order.shippingServiceLabel || order.shippingMethod}</strong>
            </div>
            <div className="summary-total">
              <span>Total</span>
              <strong>{money(order.totalCents)}</strong>
            </div>
          </div>
          <div className={`address-match-card admin ${order.shippingQuoteStatus.toLowerCase().replace("_", "-")}`}>
            <span>{order.shippingQuoteStatus}</span>
            <strong>
              {order.shippingCarrier || "Frete"} {order.shippingZone ? `/ ${order.shippingZone}` : ""}
            </strong>
            <small>{order.shippingQuoteMessage || "Frete salvo para conferencia."}</small>
            {order.shippingWeightGrams ? (
              <small>
                Peso cobrado: {(order.shippingWeightGrams / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg
              </small>
            ) : null}
            {order.shippingRateId ? <small>Rate ID: {order.shippingRateId}</small> : null}
          </div>
        </div>
      </section>
      <section className="cart-panel admin-order-items">
        <h2>Itens</h2>
        {order.items.map((item) => (
          <article className="cart-row" key={item.id}>
            <img src={item.productImage} alt={item.productName} />
            <div>
              <span>{item.productBrand}</span>
              <strong>{item.productName}</strong>
              <small>
                {item.quantity} x {money(item.unitPriceCents)}
              </small>
            </div>
            <strong>{money(item.lineTotalCents)}</strong>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
