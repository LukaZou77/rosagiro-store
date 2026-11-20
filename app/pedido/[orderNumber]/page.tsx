import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PixPaymentInfo } from "@/components/PixPaymentInfo";
import { OrderConversionTracker } from "@/components/OrderConversionTracker";
import { StoreShell } from "@/components/StoreShell";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { getCategories } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { isSeparateFreight, separateFreightNotice } from "@/lib/freight-policy";
import { mercadoPagoPaymentAwaiting, savedMercadoPagoCheckoutUrl } from "@/lib/mercado-pago-checkout-url";
import { money } from "@/lib/money";
import { hasOrderAccess } from "@/lib/order-access";
import {
  isPaymentConfirmed,
  mercadoPagoReturnMessage,
  paymentMethodLabel,
  paymentModeForEnvironment,
  paymentProviderLabel,
  paymentStatusLabel,
  simulatedPaymentConfirmedStatus,
  simulatedPaymentPendingStatus
} from "@/lib/payments";
import { noIndexMetadata } from "@/lib/seo";
import { getPublicPixPaymentAccount, getStoreProfile, pixPaymentAccountFromPayload } from "@/lib/store-profile";
import { buildOrderPaymentWhatsAppHref, buildWhatsAppBaseHref } from "@/lib/whatsapp";

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
export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: PageProps) {
  const { orderNumber } = await params;
  const authorized = await hasOrderAccess(orderNumber);
  if (!authorized) {
    const categories = await getCategories();
    const supportHref = `${buildWhatsAppBaseHref()}?text=${encodeURIComponent("Oi, preciso de um novo link seguro para acompanhar meu pedido.")}`;
    return (
      <StoreShell categories={categories}>
        <section className="confirmation order-confirmation">
          <p className="eyebrow">Acesso ao pedido</p>
          <h1>Use um link seguro para continuar.</h1>
          <p>Para proteger seus dados, este endereço sozinho não libera detalhes do pedido.</p>
          <p>Peça ao atendimento um novo link seguro de acompanhamento.</p>
          <WhatsAppLink className="button whatsapp" href={supportHref}>
            Solicitar link seguro
          </WhatsAppLink>
          <Link className="button primary" href="/">
            Voltar ao início
          </Link>
        </section>
      </StoreShell>
    );
  }
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
  const paymentConfirmed = isPaymentConfirmed(order.payment?.status, order.payment?.paidAt, order.payment?.providerStatus);
  const simulated = order.payment?.providerStatus === simulatedPaymentConfirmedStatus;
  const canceled = order.status === "CANCELED";
  const displayStatus = !paymentConfirmed && !canceled ? "PENDING_PAYMENT" : order.status;
  const showTracker = !simulated && order.payment?.providerStatus !== simulatedPaymentPendingStatus;
  const mercadoPagoMessage = mercadoPagoReturnMessage(query.mp);
  const awaitingMercadoPago = mercadoPagoPaymentAwaiting(order);
  const canResumeMercadoPago = Boolean(savedMercadoPagoCheckoutUrl(order, paymentModeForEnvironment()));
  const separateFreight = isSeparateFreight(order);
  const pixAccount =
    order.payment?.method === "PIX"
      ? pixPaymentAccountFromPayload(order.payment.providerPayload) || getPublicPixPaymentAccount(storeProfile)
      : null;
  const paymentWhatsAppHref = buildOrderPaymentWhatsAppHref(order.orderNumber, order.totalCents, storeProfile.whatsapp);

  return (
    <StoreShell categories={categories}>
        {showTracker ? <OrderConversionTracker
          orderNumber={order.orderNumber}
          orderStatus={order.status}
          paymentConfirmed={paymentConfirmed}
          totalCents={order.totalCents}
          items={order.items.map((item) => ({
            productSlug: item.productSlug,
            productName: item.productName,
            productBrand: item.productBrand,
            productSkuName: item.productSkuName,
            unitPriceCents: item.unitPriceCents,
            quantity: item.quantity
          }))}
        /> : null}
      <section className="confirmation order-confirmation">
        <p className="eyebrow">Pedido RosaGiro</p>
        <h1>{displayStatus === "SHIPPED" ? "Pedido enviado." : displayStatus === "FULFILLING" ? "Pedido em separação." : displayStatus === "PAID" ? "Compra confirmada." : canceled ? "Pedido cancelado." : simulated ? "Pagamento de teste concluído." : "Pedido criado."}</h1>
        <p>{order.customerName}, acompanhe aqui o status do pedido e confira os dados antes da entrega.</p>
        {mercadoPagoMessage ? <p className="payment-return-note">{mercadoPagoMessage}</p> : null}
        <div className="confirmation-card">
          <span>Número do pedido</span>
          <strong>{order.orderNumber}</strong>
          <small>
            {simulated ? "Pagamento de teste" : `${paymentProviderLabel(order.payment?.provider)} - ${paymentMethodLabel(order.payment?.method)}`} /{" "}
            {simulated ? "Simulação concluída" : paymentStatusLabel(paymentConfirmed ? "PAID" : order.payment?.status === "FAILED" ? "FAILED" : "PENDING")} / {separateFreight ? "Valor dos produtos" : "Total"}: {money(order.totalCents)}
          </small>
        </div>
        {order.trackingCode ? (
          <div className="address-match-card">
            <span>Rastreamento da entrega</span>
            <strong>{order.fulfillmentCarrier}</strong>
            <small>Código de rastreio: {order.trackingCode}</small>
          </div>
        ) : null}
        {separateFreight ? (
          <div className="address-match-card needs-review">
            <span>Frete não incluído no pagamento</span>
            <strong>A combinar e pagar separadamente</strong>
            <small>{separateFreightNotice}</small>
          </div>
        ) : null}
        {awaitingMercadoPago ? (
          <div className="address-match-card needs-review">
            <span>Mercado Pago</span>
            <strong>{canResumeMercadoPago ? "Pagamento disponível" : "Pagamento a conferir"}</strong>
            <small>Se você já tentou pagar, confira se houve cobrança antes de tentar novamente.</small>
            {canResumeMercadoPago ? (
              <a className="button primary" href={`/pedido/${encodeURIComponent(order.orderNumber)}/pagamento`}>
                Continuar pagamento no Mercado Pago
              </a>
            ) : (
              <WhatsAppLink
                className="button whatsapp"
                href={buildOrderPaymentWhatsAppHref(order.orderNumber, order.totalCents, storeProfile.whatsapp, "payment_review")}
              >
                Conferir pagamento pelo WhatsApp
              </WhatsAppLink>
            )}
          </div>
        ) : null}
        {pixAccount && !canceled && !paymentConfirmed && order.payment?.provider !== "MERCADO_PAGO" ? (
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
            {separateFreight
              ? "A combinar e pagar separadamente"
              : `${money(order.shippingCents)} / ${order.shippingWeightGrams ? `${(order.shippingWeightGrams / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg` : "peso a conferir"}`}
          </strong>
          <small>{separateFreight ? separateFreightNotice : order.shippingQuoteMessage || "Frete salvo para conferência operacional."}</small>
        </div>
        <div className="order-items">
          {order.items.map((item) => (
            <div key={item.id}>
              <span>
                {item.productName}
                {item.productSkuName ? ` - ${item.productSkuName}` : ""}
                <br />
                <small>
                  {item.packagePieces && item.packageCount && item.packagePriceCents ? (
                    <>
                      {item.packageCount} {item.packageCount === 1 ? "embalagem" : "embalagens"} de {item.packagePieces} {item.packagePieces === 1 ? "unidade" : "unidades"}
                      {" · "}{money(item.packagePriceCents)} por embalagem
                    </>
                  ) : (
                    <>{item.quantity} {item.quantity === 1 ? "unidade" : "unidades"}</>
                  )}
                </small>
              </span>
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
