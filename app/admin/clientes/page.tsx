import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { createAdminTranslator } from "@/lib/admin-i18n";
import { getAdminLocale } from "@/lib/admin-i18n-server";
import { formatAdminDateTime } from "@/lib/date-format";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";

export default async function AdminCustomersPage() {
  const [admin, locale] = await Promise.all([requireAdmin(), getAdminLocale()]);
  const t = createAdminTranslator(locale);
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
        <p className="eyebrow">{t("Clientes", "客户")}</p>
        <h1>{t("Clientes via WhatsApp", "WhatsApp 客户")}</h1>
        <p>{t("Lista de clientes que entraram pelo login leve antes de adicionar produto ou ir ao checkout.", "查看在加购或进入结账前通过简易登录留下资料的客户。")}</p>
      </div>

      <div className="metric-grid readiness-metrics">
        <div>
          <span>{t("Clientes", "客户")}</span>
          <strong>{totalCustomers}</strong>
          <small>{t("WhatsApp único", "去重后的 WhatsApp")}</small>
        </div>
        <div>
          <span>{t("Com pedidos", "已创建订单")}</span>
          <strong>{customersWithOrders}</strong>
          <small>{t("Já criaram pedido local", "已在本站创建订单")}</small>
        </div>
        <div>
          <span>{t("Uso", "用途")}</span>
          <strong>{t("Interno", "内部使用")}</strong>
          <small>{t("Sem senha, OTP ou conta pública", "无密码、验证码或公开账户")}</small>
        </div>
      </div>

      <div className="admin-notice">
        {t("Esta primeira versão salva nome e WhatsApp para atendimento e compra no atacado. Não cole tokens, documentos ou observações sensíveis neste cadastro.", "当前版本仅保存姓名和 WhatsApp，用于批发咨询与购买。请勿在此填写令牌、证件或敏感备注。")}
      </div>

      <div className="admin-table">
        {customers.map((customer) => {
          const lastOrder = customer.orders[0];
          return (
            <article className="admin-order-row customer-row" key={customer.id}>
              <div>
                <strong>{customer.name}</strong>
                <span>{customer.whatsapp}</span>
                <small>{t("Primeiro acesso: ", "首次访问：")}{formatAdminDateTime(customer.firstSeenAt, t("Sem registro", "未记录"), locale)}</small>
              </div>
              <div>
                <span>{customer.loginCount} {t("entradas", "次登录")}</span>
                <small>{t("Última entrada: ", "最近登录：")}{formatAdminDateTime(customer.lastLoginAt, t("Sem registro", "未记录"), locale)}</small>
                <small>{t("Última atividade: ", "最近活动：")}{formatAdminDateTime(customer.lastSeenAt, t("Sem registro", "未记录"), locale)}</small>
              </div>
              <div>
                <span>{customer._count.orders} {t("pedidos", "个订单")}</span>
                {lastOrder ? (
                  <>
                    <Link href={`/admin/pedidos/${lastOrder.orderNumber}`} prefetch={false}>
                      <strong>{lastOrder.orderNumber}</strong>
                    </Link>
                    <small>
                      {money(lastOrder.totalCents)} / {lastOrder.status} / {formatAdminDateTime(lastOrder.createdAt, t("Sem registro", "未记录"), locale)}
                    </small>
                  </>
                ) : (
                  <small>{t("Nenhum pedido criado ainda", "尚未创建订单")}</small>
                )}
              </div>
            </article>
          );
        })}
        {!customers.length ? (
          <div className="empty-state">
            <strong>{t("Nenhum cliente ainda", "暂无客户")}</strong>
            <p>{t("Quando um visitante entrar via WhatsApp antes de comprar, ele aparecerá aqui.", "访客在购买前通过 WhatsApp 登录后会显示在这里。")}</p>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
