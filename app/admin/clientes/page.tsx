import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { formatAdminDateTime } from "@/lib/date-format";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";

export default async function AdminCustomersPage() {
  const admin = await requireAdmin();
  const [customers, totalCustomers, customersWithOrders] = await Promise.all([
    prisma.customer.findMany({
      include: {
        _count: { select: { orders: true } },
        orders: {
          select: {
            orderNumber: true,
            totalCents: true,
            status: true,
            createdAt: true
          },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      },
      orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
      take: 100
    }),
    prisma.customer.count(),
    prisma.customer.count({ where: { orders: { some: {} } } })
  ]);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Clientes</p>
        <h1>Clientes via WhatsApp</h1>
        <p>Lista de clientes que entraram pelo login leve antes de adicionar produto ou ir ao checkout.</p>
      </div>

      <div className="metric-grid readiness-metrics">
        <div>
          <span>Clientes</span>
          <strong>{totalCustomers}</strong>
          <small>WhatsApp único</small>
        </div>
        <div>
          <span>Com pedidos</span>
          <strong>{customersWithOrders}</strong>
          <small>Já criaram pedido local</small>
        </div>
        <div>
          <span>Uso</span>
          <strong>Interno</strong>
          <small>Sem senha, OTP ou conta pública</small>
        </div>
      </div>

      <div className="admin-notice">
        Esta primeira versão salva nome e WhatsApp para atendimento e compra no atacado. Não cole tokens, documentos ou
        observações sensíveis neste cadastro.
      </div>

      <div className="admin-table">
        {customers.map((customer) => {
          const lastOrder = customer.orders[0];
          return (
            <article className="admin-order-row customer-row" key={customer.id}>
              <div>
                <strong>{customer.name}</strong>
                <span>{customer.whatsapp}</span>
                <small>Primeiro acesso: {formatAdminDateTime(customer.firstSeenAt)}</small>
              </div>
              <div>
                <span>{customer.loginCount} entradas</span>
                <small>Última entrada: {formatAdminDateTime(customer.lastLoginAt)}</small>
                <small>Última atividade: {formatAdminDateTime(customer.lastSeenAt)}</small>
              </div>
              <div>
                <span>{customer._count.orders} pedidos</span>
                {lastOrder ? (
                  <>
                    <Link href={`/admin/pedidos/${lastOrder.orderNumber}`} prefetch={false}>
                      <strong>{lastOrder.orderNumber}</strong>
                    </Link>
                    <small>
                      {money(lastOrder.totalCents)} / {lastOrder.status} / {formatAdminDateTime(lastOrder.createdAt)}
                    </small>
                  </>
                ) : (
                  <small>Nenhum pedido criado ainda</small>
                )}
              </div>
            </article>
          );
        })}
        {!customers.length ? (
          <div className="empty-state">
            <strong>Nenhum cliente ainda</strong>
            <p>Quando um visitante entrar via WhatsApp antes de comprar, ele aparecerá aqui.</p>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
