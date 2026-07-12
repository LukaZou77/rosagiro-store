import type { Prisma } from "@/src/generated/prisma/client";
import Link from "next/link";
import { Download, Filter, Search } from "lucide-react";
import { updateOrderStatusAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { createAdminTranslator } from "@/lib/admin-i18n";
import { getAdminLocale } from "@/lib/admin-i18n-server";
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

const statusLabelsZh: Record<(typeof statuses)[number], string> = {
  PENDING_PAYMENT: "等待付款",
  PAID: "已付款",
  FULFILLING: "配货中",
  SHIPPED: "已发货",
  CANCELED: "已取消"
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
  const [admin, params, locale] = await Promise.all([requireAdmin(), searchParams, getAdminLocale()]);
  const t = createAdminTranslator(locale);
  const localizedStatusLabels = locale === "zh-CN" ? statusLabelsZh : statusLabels;
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
        <p className="eyebrow">{t("Operação", "运营")}</p>
        <h1>{t("Pedidos", "订单")}</h1>
        <p>{t("Busque clientes, confira pagamentos e atualize a etapa operacional sem alterar o estoque automaticamente.", "搜索客户、核对付款并更新订单状态；系统不会自动修改库存。")}</p>
        <div className="admin-actions">
          <Link className="button secondary" href="/admin/pedidos/exportar-conversoes" prefetch={false}><Download size={15} />{t("Exportar conversões pagas", "导出已付款转化")}</Link>
        </div>
      </div>

      <div className="metric-grid compact admin-order-metrics">
        <div><span>{t("Resultado filtrado", "筛选结果")}</span><strong>{total}</strong><small>{totalPages} {t("página(s)", "页")}</small></div>
        <div><span>{t("Aguardando pagamento", "等待付款")}</span><strong>{pendingCount}</strong><small>{t("Fila atual", "当前待办")}</small></div>
        <div><span>{t("Pedidos pagos", "已付款订单")}</span><strong>{paidCount}</strong><small>{t("Histórico atual", "当前历史记录")}</small></div>
        <div><span>{t("Valor do filtro", "筛选订单总额")}</span><strong>{money(filteredRevenue._sum.totalCents || 0)}</strong><small>{t("Não equivale só a pagos", "包含未付款订单，不等于实收")}</small></div>
      </div>

      <form className="admin-order-filters" action="/admin/pedidos">
        <label className="admin-order-search"><span>{t("Buscar", "搜索")}</span><div><Search size={16} /><input name="q" defaultValue={query} placeholder={t("Pedido, cliente, e-mail ou WhatsApp", "订单、客户、邮箱或 WhatsApp")} /></div></label>
        <label><span>{t("Status", "状态")}</span><select name="status" defaultValue={status}><option value="all">{t("Todos", "全部")}</option>{statuses.map((item) => <option value={item} key={item}>{localizedStatusLabels[item]}</option>)}</select></label>
        <label><span>{t("Pagamento", "付款方式")}</span><select name="payment" defaultValue={payment}><option value="all">{t("Todos", "全部")}</option><option value="PIX">Pix</option><option value="CREDIT_CARD">{t("Cartão", "银行卡")}</option><option value="SIMULATED">{t("Atendimento", "人工服务")}</option></select></label>
        <label><span>{t("De", "开始日期")}</span><input name="dateFrom" type="date" defaultValue={dateFrom} /></label>
        <label><span>{t("Até", "结束日期")}</span><input name="dateTo" type="date" defaultValue={dateTo} /></label>
        <button className="button primary" type="submit"><Filter size={15} />{t("Aplicar", "应用")}</button>
        <Link className="button secondary" href="/admin/pedidos" prefetch={false}>{t("Limpar", "清除")}</Link>
      </form>

      <section className="admin-panel admin-orders-table-panel">
        <div className="admin-compact-table-wrap">
          <table className="admin-data-table admin-orders-table">
            <thead><tr><th>{t("Pedido", "订单")}</th><th>{t("Cliente", "客户")}</th><th>{t("Pagamento", "付款")}</th><th>{t("Status", "状态")}</th><th>{t("Itens", "商品")}</th><th>{t("Total", "总额")}</th><th>{t("Atualizar", "更新")}</th></tr></thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td><Link href={`/admin/pedidos/${order.orderNumber}`} prefetch={false}>{order.orderNumber}</Link><small>{formatAdminDateTime(order.createdAt, t("Sem registro", "未记录"), locale)}</small></td>
                  <td><strong>{order.customerName}</strong><small>{order.customerPhone}</small></td>
                  <td><span>{paymentProviderLabel(order.payment?.provider)} / {paymentMethodLabel(order.payment?.method)}</span><small>{paymentStatusLabel(order.payment?.status)}</small></td>
                  <td><span className={`admin-status-dot status-${order.status.toLowerCase()}`}>{localizedStatusLabels[order.status]}</span></td>
                  <td>{order._count.items}</td>
                  <td><strong>{money(order.totalCents)}</strong></td>
                  <td>
                    <form action={updateOrderStatusAction} className="admin-inline-status-form">
                      <input type="hidden" name="orderNumber" value={order.orderNumber} />
                      <select name="status" defaultValue={order.status}>{statuses.map((item) => <option value={item} key={item}>{localizedStatusLabels[item]}</option>)}</select>
                      <button type="submit">{t("Salvar", "保存")}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!orders.length ? <div className="admin-empty-compact">{t("Nenhum pedido corresponde aos filtros.", "没有符合筛选条件的订单。")}</div> : null}
        </div>
      </section>

      {totalPages > 1 ? (
        <nav className="admin-pagination" aria-label={t("Paginação de pedidos", "订单分页")}>
          <Link className={page <= 1 ? "is-disabled" : ""} href={pageHref(preserved, Math.max(1, page - 1))} prefetch={false} aria-disabled={page <= 1}>{t("Anterior", "上一页")}</Link>
          <span>{t("Página", "第")} {page} {t("de", "页，共")} {totalPages} {locale === "zh-CN" ? "页" : ""}</span>
          <Link className={page >= totalPages ? "is-disabled" : ""} href={pageHref(preserved, Math.min(totalPages, page + 1))} prefetch={false} aria-disabled={page >= totalPages}>{t("Próxima", "下一页")}</Link>
        </nav>
      ) : null}
    </AdminShell>
  );
}
