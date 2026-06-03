import Link from "next/link";
import { notFound } from "next/navigation";
import { StoreShell } from "@/components/StoreShell";
import { getCategories } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { mercadoPagoReturnMessage, paymentMethodLabel, paymentProviderLabel, paymentStatusLabel } from "@/lib/payments";

const addressMatchLabels: Record<string, string> = {
  VALIDATED: "Endereco validado",
  NEEDS_REVIEW: "Endereco para conferencia",
  FAILED: "Validacao indisponivel",
  DISABLED: "Validacao nao configurada",
  NOT_CHECKED: "Validacao nao executada"
};

type PageProps = {
  params: Promise<{ orderNumber: string }>;
  searchParams?: Promise<{ mp?: string }>;
};

export default async function OrderPage({ params, searchParams }: PageProps) {
  const { orderNumber } = await params;
  const query = searchParams ? await searchParams : {};
  const [categories, order] = await Promise.all([
    getCategories(),
    prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true, payment: true }
    })
  ]);

  if (!order) notFound();
  const mercadoPagoMessage = mercadoPagoReturnMessage(query.mp);

  return (
    <StoreShell categories={categories}>
      <section className="confirmation order-confirmation">
        <p className="eyebrow">Pedido Bela Viva</p>
        <h1>{order.status === "PAID" ? "Compra confirmada." : "Pedido criado."}</h1>
        <p>{order.customerName}, acompanhe aqui o status do pedido e confira os dados antes da entrega.</p>
        {mercadoPagoMessage ? <p className="payment-return-note">{mercadoPagoMessage}</p> : null}
        <div className="confirmation-card">
          <span>Numero do pedido</span>
          <strong>{order.orderNumber}</strong>
          <small>
            Status: {order.status.replace("_", " ")} / {paymentProviderLabel(order.payment?.provider)} -{" "}
            {paymentMethodLabel(order.payment?.method)} / {paymentStatusLabel(order.payment?.status)} / Total: {money(order.totalCents)}
          </small>
        </div>
        {order.payment?.provider === "MERCADO_PAGO" ? (
          <div className="address-match-card needs-review">
            <span>Mercado Pago</span>
            <strong>{order.payment.providerStatus || "Aguardando retorno"}</strong>
            <small>{order.payment.syncError || "A confirmacao do provedor atualizara o pedido automaticamente."}</small>
          </div>
        ) : null}
        <div className={`address-match-card ${order.addressMatchStatus.toLowerCase().replace("_", "-")}`}>
          <span>{addressMatchLabels[order.addressMatchStatus] || "Endereco salvo"}</span>
          <strong>{order.addressMatchFormatted || `${order.street}, ${order.number} - ${order.city}/${order.state}`}</strong>
          <small>{order.addressMatchMessage || "Confira o endereco antes do envio."}</small>
        </div>
        <div className={`address-match-card ${order.shippingQuoteStatus.toLowerCase().replace("_", "-")}`}>
          <span>{order.shippingServiceLabel || "Entrega"}</span>
          <strong>
            {money(order.shippingCents)} / {order.shippingWeightGrams ? `${(order.shippingWeightGrams / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg` : "peso a conferir"}
          </strong>
          <small>{order.shippingQuoteMessage || "Frete salvo para conferencia operacional."}</small>
        </div>
        <div className="order-items">
          {order.items.map((item) => (
            <div key={item.id}>
              <span>{item.quantity}x {item.productName}</span>
              <strong>{money(item.lineTotalCents)}</strong>
            </div>
          ))}
        </div>
        <Link className="button primary" href="/">
          Voltar ao inicio
        </Link>
      </section>
    </StoreShell>
  );
}
