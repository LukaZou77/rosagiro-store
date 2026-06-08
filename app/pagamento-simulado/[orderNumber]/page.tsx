import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PixPaymentInfo } from "@/components/PixPaymentInfo";
import { SimulatePaymentButton } from "@/components/SimulatePaymentButton";
import { StoreShell } from "@/components/StoreShell";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { getCategories } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { paymentMethodLabel } from "@/lib/payments";
import { noIndexMetadata } from "@/lib/seo";
import { getPublicPixPaymentAccount, getStoreProfile, pixPaymentAccountFromPayload } from "@/lib/store-profile";
import { buildOrderPaymentWhatsAppHref } from "@/lib/whatsapp";

type PageProps = {
  params: Promise<{ orderNumber: string }>;
};

export const metadata: Metadata = noIndexMetadata("Pagamento", "Confirmação de pagamento RosaGiro.");

export default async function SimulatedPaymentPage({ params }: PageProps) {
  const { orderNumber } = await params;
  const [categories, order, storeProfile] = await Promise.all([
    getCategories(),
    prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true, payment: true }
    }),
    getStoreProfile()
  ]);

  if (!order) notFound();
  const pixAccount =
    order.payment?.method === "PIX"
      ? pixPaymentAccountFromPayload(order.payment.providerPayload) || getPublicPixPaymentAccount(storeProfile)
      : null;
  const paymentWhatsAppHref = buildOrderPaymentWhatsAppHref(order.orderNumber, order.totalCents);

  return (
    <StoreShell categories={categories}>
      <section className="confirmation">
        <p className="eyebrow">Confirmação do pedido</p>
        <h1>Confirme para reservar os itens.</h1>
        <p>Ao confirmar, o pedido será marcado como pago e o estoque será reservado para acompanhamento.</p>
        <div className="confirmation-card">
          <span>Pedido</span>
          <strong>{order.orderNumber}</strong>
          <small>
            {paymentMethodLabel(order.payment?.method)} / Total: {money(order.totalCents)}
          </small>
        </div>
        {pixAccount && order.status !== "PAID" ? (
          <>
            <PixPaymentInfo account={pixAccount} orderNumber={order.orderNumber} totalCents={order.totalCents} />
            <WhatsAppLink className="button whatsapp" href={paymentWhatsAppHref}>
              Enviar comprovante pelo WhatsApp
            </WhatsAppLink>
            <Link className="button secondary" href={`/pedido/${order.orderNumber}`}>
              Acompanhar pedido
            </Link>
          </>
        ) : order.payment?.method === "PIX" && order.status !== "PAID" ? (
          <div className="address-match-card needs-review">
            <span>Pix com atendimento</span>
            <strong>Os dados Pix serão confirmados pelo WhatsApp.</strong>
            <small>Envie o número do pedido para receber a chave atual e evitar pagar em conta incorreta.</small>
            <WhatsAppLink className="button whatsapp" href={paymentWhatsAppHref}>
              Falar no WhatsApp
            </WhatsAppLink>
          </div>
        ) : order.status === "PAID" ? (
          <Link className="button primary" href={`/pedido/${order.orderNumber}`}>
            Ver pedido confirmado
          </Link>
        ) : (
          <SimulatePaymentButton orderNumber={order.orderNumber} />
        )}
      </section>
    </StoreShell>
  );
}
