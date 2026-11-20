import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PixPaymentInfo } from "@/components/PixPaymentInfo";
import { SimulatePaymentButton } from "@/components/SimulatePaymentButton";
import { StoreShell } from "@/components/StoreShell";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { getCategories } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { hasOrderAccess } from "@/lib/order-access";
import {
  canConfirmSimulatedPayment,
  isPaymentConfirmed,
  paymentMethodLabel,
  simulatedPaymentConfirmedStatus,
  simulatedPaymentEnabled
} from "@/lib/payments";
import { noIndexMetadata } from "@/lib/seo";
import { getPublicPixPaymentAccount, getStoreProfile, pixPaymentAccountFromPayload } from "@/lib/store-profile";
import { buildOrderPaymentWhatsAppHref, buildWhatsAppBaseHref } from "@/lib/whatsapp";

type PageProps = {
  params: Promise<{ orderNumber: string }>;
};

export const metadata: Metadata = noIndexMetadata("Pagamento", "Confirmação de pagamento RosaGiro.");
export const dynamic = "force-dynamic";

export default async function SimulatedPaymentPage({ params }: PageProps) {
  const { orderNumber } = await params;
  const authorized = await hasOrderAccess(orderNumber);
  if (!authorized) {
    const categories = await getCategories();
    const supportHref = `${buildWhatsAppBaseHref()}?text=${encodeURIComponent("Oi, preciso de um novo link seguro para acessar meu pedido.")}`;
    return (
      <StoreShell categories={categories}>
        <section className="confirmation">
          <p className="eyebrow">Acesso ao pagamento</p>
          <h1>Use um link seguro para continuar.</h1>
          <p>Para proteger seus dados, este endereço sozinho não libera detalhes ou ações do pedido.</p>
          <p>Peça ao atendimento um novo link seguro.</p>
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
  const [categories, order, storeProfile] = await Promise.all([
    getCategories(),
    prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true, payment: true }
    }),
    getStoreProfile()
  ]);

  if (!order) notFound();
  if (order.payment?.provider === "MERCADO_PAGO") redirect(`/pedido/${encodeURIComponent(orderNumber)}`);
  const paymentConfirmed = isPaymentConfirmed(order.payment?.status, order.payment?.paidAt, order.payment?.providerStatus);
  const testConfirmed = order.payment?.providerStatus === simulatedPaymentConfirmedStatus;
  const canceled = order.status === "CANCELED";
  const showSimulation = !canceled && !testConfirmed && simulatedPaymentEnabled() && canConfirmSimulatedPayment(order.payment);
  const pixAccount =
    order.payment?.method === "PIX"
      ? pixPaymentAccountFromPayload(order.payment.providerPayload) || getPublicPixPaymentAccount(storeProfile)
      : null;
  const pix = order.payment?.method === "PIX";
  const paymentWhatsAppHref = buildOrderPaymentWhatsAppHref(
    order.orderNumber,
    order.totalCents,
    storeProfile.whatsapp,
    pixAccount ? "proof" : pix ? "pix_details" : "transfer_details"
  );

  return (
    <StoreShell categories={categories}>
      <section className="confirmation">
        <p className="eyebrow">Confirmação do pedido</p>
        <h1>{canceled ? "Pedido cancelado." : paymentConfirmed ? "Pagamento confirmado." : testConfirmed ? "Pagamento de teste concluído." : "Pedido recebido."}</h1>
        {showSimulation ? <p>Use este botão para simular o pagamento no ambiente de teste.</p> : null}
        {!canceled && !paymentConfirmed && !testConfirmed && !showSimulation ? (
          <p>Aguarde a confirmação do estoque e dos dados de pagamento pelo atendimento no WhatsApp.</p>
        ) : null}
        <div className="confirmation-card">
          <span>Pedido</span>
          <strong>{order.orderNumber}</strong>
          <small>
            {showSimulation || testConfirmed ? "Pagamento de teste" : paymentMethodLabel(order.payment?.method)} / Total: {money(order.totalCents)}
          </small>
        </div>
        {canceled || paymentConfirmed || testConfirmed ? (
          <Link className="button primary" href={`/pedido/${order.orderNumber}`}>
            Acompanhar pedido
          </Link>
        ) : showSimulation ? (
          <SimulatePaymentButton orderNumber={order.orderNumber} />
        ) : pixAccount ? (
          <>
            <PixPaymentInfo account={pixAccount} orderNumber={order.orderNumber} totalCents={order.totalCents} />
            <WhatsAppLink className="button whatsapp" href={paymentWhatsAppHref}>
              Enviar comprovante pelo WhatsApp
            </WhatsAppLink>
            <Link className="button secondary" href={`/pedido/${order.orderNumber}`}>
              Acompanhar pedido
            </Link>
          </>
        ) : pix ? (
          <div className="address-match-card needs-review">
            <span>Pix com atendimento</span>
            <strong>Os dados Pix serão confirmados pelo WhatsApp.</strong>
            <small>Envie o número do pedido para receber a chave atual e evitar pagar em conta incorreta.</small>
            <WhatsAppLink className="button whatsapp" href={paymentWhatsAppHref}>
              Falar no WhatsApp
            </WhatsAppLink>
          </div>
        ) : (
          <>
            <WhatsAppLink className="button whatsapp" href={paymentWhatsAppHref}>
              Combinar pagamento pelo WhatsApp
            </WhatsAppLink>
            <Link className="button secondary" href={`/pedido/${order.orderNumber}`}>
              Acompanhar pedido
            </Link>
          </>
        )}
      </section>
    </StoreShell>
  );
}
