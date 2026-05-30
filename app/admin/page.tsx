import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";

export default async function AdminPage() {
  const admin = await requireAdmin();
  const [productCount, pendingOrders, paidOrders, revenue] = await Promise.all([
    prisma.product.count(),
    prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
    prisma.order.count({ where: { status: "PAID" } }),
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { totalCents: true } })
  ]);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Resumo</p>
        <h1>Operacao Bela Viva</h1>
      </div>
      <div className="metric-grid">
        <Link href="/admin/produtos">
          <span>Produtos</span>
          <strong>{productCount}</strong>
        </Link>
        <Link href="/admin/pedidos">
          <span>Pedidos pendentes</span>
          <strong>{pendingOrders}</strong>
        </Link>
        <Link href="/admin/pedidos">
          <span>Pedidos pagos</span>
          <strong>{paidOrders}</strong>
        </Link>
        <div>
          <span>Receita simulada</span>
          <strong>{money(revenue._sum.totalCents || 0)}</strong>
        </div>
      </div>
    </AdminShell>
  );
}
