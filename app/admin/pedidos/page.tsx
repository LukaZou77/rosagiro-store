import type { Prisma } from "@/src/generated/prisma/client";
import Link from "next/link";
import { Download, Filter, Search } from "lucide-react";
import { updateOrderStatusAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { formatAdminDateTime } from "@/lib/date-format";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { paymentMethodLabel, paymentProviderLabel, paymentStatusLabel } from "@/lib/payments";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const pageSize = 50;
const statuses = ["PENDING_PAYMENT", "PAID", "FULFILLING", "SHIPPED", "CANCELED"] as const;
const paymentMethods = ["SIMULATED", "PIX", "CREDIT_CARD"] as const;
const statusLabels: Record<(typeof statuses)[number], string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  FULFILLING: "Em separação",
  SHIPPED: "Enviado",
  CANCELED: "Cancelado"
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function saoPauloBoundary(value: string, nextDay = false) {
  if (!value) return undefined;
  const date = new Date(`${value}T03:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  if (nextDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function pageHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/admin/pedidos?${next.toString()}`;
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const [admin, params] = await Promise.all([requireAdmin(), searchParams]);
  const query = single(params.q)?.trim().slice(0, 100) || "";
  const rawStatus = single(params.status) || "all";
  const rawPayment = single(params.payment) || "all";
  const status = statuses.includes(rawStatus as (typeof statuses)[number]) ? rawStatus as (typeof statuses)[number] : "all";
  const payment = paymentMethods.includes(rawPayment as (typeof paymentMethods)[number]) ? rawPayment as (typeof paymentMethods)[number] : "all";
  const dateFrom = validDate(single(params.dateFrom) || "");
  const dateTo = validDate(single(params.dateTo) || "");
  const requestedPage = Math.max(1, Number(single(params.page)) || 1);
  const where: Prisma.OrderWhereInput = {
    status: status === "all" ? undefined : status,
    payment: payment === "all" ? undefined : { method: payment },
    createdAt: dateFrom || dateTo ? {
      gte: saoPauloBoundary(dateFrom),
      lt: saoPauloBoundary(dateTo, true)
    } : undefined,
    OR: query ? [
      { orderNumber: { contains: query, mode: "insensitive" } },
      { customerName: { contains: query, mode: "insensitive" } },
      { customerPhone: { contains: query, mode: "insensitive" } },
      { customerEmail: { contains: query, mode: "insensitive" } }
    ] : undefined
  };

  const [total, filteredRevenue, pendingCount, paidCount] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({ where, _sum: { totalCents: true } }),
    prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
    prisma.order.count({ where: { payment: { status: "PAID" } } })
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const orders = await prisma.order.findMany({
    where,
    include: { _count: { select: { items: true } }, payment: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize
  });
  const preserved = new URLSearchParams();
  if (query) preserved.set("q", query);
  if (status !== "all") preserved.set("status", status);
  if (payment !== "all") preserved.set("payment", payment);
  if (dateFrom) preserved.set("dateFrom", dateFrom);
  if (dateTo) preserved.set("dateTo", dateTo);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Operação</p>
        <h1>Pedidos</h1>
        <p>Busque clientes, confira pagamentos e atualize a etapa operacional sem alterar o estoque automaticamente.</p>
        <div className="admin-actions">
          <Link className="button secondary" href="/admin/pedidos/exportar-conversoes" prefetch={false}><Download size={15} />Exportar conversões pagas</Link>
        </div>
      </div>

      <div className="metric-grid compact admin-order-metrics">
        <div><span>Resultado filtrado</span><strong>{total}</strong><small>{totalPages} página(s)</small></div>
        <div><span>Aguardando pagamento</span><strong>{pendingCount}</strong><small>Fila atual</small></div>
        <div><span>Pedidos pagos</span><strong>{paidCount}</strong><small>Histórico atual</small></div>
        <div><span>Valor do filtro</span><strong>{money(filteredRevenue._sum.totalCents || 0)}</strong><small>Não equivale só a pagos</small></div>
      </div>

      <form className="admin-order-filters" action="/admin/pedidos">
        <label className="admin-order-search"><span>Buscar</span><div><Search size={16} /><input name="q" defaultValue={query} placeholder="Pedido, cliente, e-mail ou WhatsApp" /></div></label>
        <label><span>Status</span><select name="status" defaultValue={status}><option value="all">Todos</option>{statuses.map((item) => <option value={item} key={item}>{statusLabels[item]}</option>)}</select></label>
        <label><span>Pagamento</span><select name="payment" defaultValue={payment}><option value="all">Todos</option><option value="PIX">Pix</option><option value="CREDIT_CARD">Cartão</option><option value="SIMULATED">Atendimento</option></select></label>
        <label><span>De</span><input name="dateFrom" type="date" defaultValue={dateFrom} /></label>
        <label><span>Até</span><input name="dateTo" type="date" defaultValue={dateTo} /></label>
        <button className="button primary" type="submit"><Filter size={15} />Aplicar</button>
        <Link className="button secondary" href="/admin/pedidos" prefetch={false}>Limpar</Link>
      </form>

      <section className="admin-panel admin-orders-table-panel">
        <div className="admin-compact-table-wrap">
          <table className="admin-data-table admin-orders-table">
            <thead><tr><th>Pedido</th><th>Cliente</th><th>Pagamento</th><th>Status</th><th>Itens</th><th>Total</th><th>Atualizar</th></tr></thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td><Link href={`/admin/pedidos/${order.orderNumber}`} prefetch={false}>{order.orderNumber}</Link><small>{formatAdminDateTime(order.createdAt)}</small></td>
                  <td><strong>{order.customerName}</strong><small>{order.customerPhone}</small></td>
                  <td><span>{paymentProviderLabel(order.payment?.provider)} / {paymentMethodLabel(order.payment?.method)}</span><small>{paymentStatusLabel(order.payment?.status)}</small></td>
                  <td><span className={`admin-status-dot status-${order.status.toLowerCase()}`}>{statusLabels[order.status]}</span></td>
                  <td>{order._count.items}</td>
                  <td><strong>{money(order.totalCents)}</strong></td>
                  <td>
                    <form action={updateOrderStatusAction} className="admin-inline-status-form">
                      <input type="hidden" name="orderNumber" value={order.orderNumber} />
                      <select name="status" defaultValue={order.status}>{statuses.map((item) => <option value={item} key={item}>{statusLabels[item]}</option>)}</select>
                      <button type="submit">Salvar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!orders.length ? <div className="admin-empty-compact">Nenhum pedido corresponde aos filtros.</div> : null}
        </div>
      </section>

      {totalPages > 1 ? (
        <nav className="admin-pagination" aria-label="Paginação de pedidos">
          <Link className={page <= 1 ? "is-disabled" : ""} href={pageHref(preserved, Math.max(1, page - 1))} prefetch={false} aria-disabled={page <= 1}>Anterior</Link>
          <span>Página {page} de {totalPages}</span>
          <Link className={page >= totalPages ? "is-disabled" : ""} href={pageHref(preserved, Math.min(totalPages, page + 1))} prefetch={false} aria-disabled={page >= totalPages}>Próxima</Link>
        </nav>
      ) : null}
    </AdminShell>
  );
}
