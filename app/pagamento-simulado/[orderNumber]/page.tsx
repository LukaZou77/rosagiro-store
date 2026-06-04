import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SimulatePaymentButton } from "@/components/SimulatePaymentButton";
import { StoreShell } from "@/components/StoreShell";
import { getCategories } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { paymentMethodLabel } from "@/lib/payments";
import { noIndexMetadata } from "@/lib/seo";

type PageProps = {
  params: Promise<{ orderNumber: string }>;
};

export const metadata: Metadata = noIndexMetadata("Pagamento", "Confirmação de pagamento Bela Viva.");

export default async function SimulatedPaymentPage({ params }: PageProps) {
  const { orderNumber } = await params;
  const [categories, order] = await Promise.all([
    getCategories(),
    prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true, payment: true }
    })
  ]);

  if (!order) notFound();

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
        {order.status === "PAID" ? (
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
