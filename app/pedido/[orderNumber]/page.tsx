import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PixPaymentInfo } from "@/components/PixPaymentInfo";
import { StoreShell } from "@/components/StoreShell";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { getCategories } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { mercadoPagoReturnMessage, paymentMethodLabel, paymentProviderLabel, paymentStatusLabel } from "@/lib/payments";
import { noIndexMetadata } from "@/lib/seo";
import { getPublicPixPaymentAccount, getStoreProfile, pixPaymentAccountFromPayload } from "@/lib/store-profile";
import { buildOrderPaymentWhatsAppHref } from "@/lib/whatsapp";

const addressMatchLabels: Record<string, string> = {
  VALIDATED: "Endereço validado",
  NEEDS_REVIEW: "Endereço para conferência",
  FAILED: "Validação indisponível",
  DISABLED: "Validação não configurada",
  NOT_CHECKED: "Validação não executada"
};

type PageProps = {
  params: Promise<{ orderNumber: string }>;
  searchParams?: Promise<{ mp?: string }>;
};

export const metadata: Metadata = noIndexMetadata("Pedido", "Acompanhamento de pedido RosaGiro.");

export default async function OrderPage({ params, searchParams }: PageProps) {
  const { orderNumber } = await params;
  const query = searchParams ? await searchParams : {};
  const [categories, order, storeProfile] = await Promise.all([
    getCategories(),
    prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true, payment: true }
    }),
    getStoreProfile()
  ]);

  if (!order) notFound();
  const mercadoPagoMessage = mercadoPagoReturnMessage(query.mp);
  const pixAccount =
    order.payment?.method === "PIX"
      ? pixPaymentAccountFromPayload(order.payment.providerPayload) || getPublicPixPaymentAccount(storeProfile)
      : null;
  const paymentWhatsAppHref = buildOrderPaymentWhatsAppHref(order.orderNumber, order.totalCents);

  return (
    <StoreShell categories={categories}>
      <section className="confirmation order-confirmation">
        <p className="eyebrow">Pedido RosaGiro</p>
        <h1>{order.status === "PAID" ? "Compra confirmada." : "Pedido criado."}</h1>
        <p>{order.customerName}, acompanhe aqui o status do pedido e confira os dados antes da entrega.</p>
        {mercadoPagoMessage ? <p className="payment-return-note">{mercadoPagoMessage}</p> : null}
        <div className="confirmation-card">
          <span>Número do pedido</span>
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
            <small>{order.payment.syncError || "A confirmação do provedor atualizará o pedido automaticamente."}</small>
          </div>
        ) : null}
        {pixAccount && order.status !== "PAID" ? (
          <>
            <PixPaymentInfo account={pixAccount} orderNumber={order.orderNumber} totalCents={order.totalCents} />
            <WhatsAppLink className="button whatsapp" href={paymentWhatsAppHref}>
              Enviar comprovante pelo WhatsApp
            </WhatsAppLink>
          </>
        ) : null}
        <div className={`address-match-card ${order.addressMatchStatus.toLowerCase().replace("_", "-")}`}>
          <span>{addressMatchLabels[order.addressMatchStatus] || "Endereço salvo"}</span>
          <strong>{order.addressMatchFormatted || `${order.street}, ${order.number} - ${order.city}/${order.state}`}</strong>
          <small>{order.addressMatchMessage || "Confira o endereço antes do envio."}</small>
        </div>
        <div className={`address-match-card ${order.shippingQuoteStatus.toLowerCase().replace("_", "-")}`}>
          <span>{order.shippingServiceLabel || "Entrega"}</span>
          <strong>
            {money(order.shippingCents)} / {order.shippingWeightGrams ? `${(order.shippingWeightGrams / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg` : "peso a conferir"}
          </strong>
          <small>{order.shippingQuoteMessage || "Frete salvo para conferência operacional."}</small>
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
          Voltar ao início
        </Link>
      </section>
    </StoreShell>
  );
}
