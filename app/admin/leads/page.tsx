import { MessageCircleMore, TrendingUp, UserCheck } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { createWhatsAppLeadAction, updateWhatsAppLeadStatusAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { createAdminTranslator } from "@/lib/admin-i18n";
import { getAdminLocale } from "@/lib/admin-i18n-server";
import { formatAdminDateTime } from "@/lib/date-format";
import { prisma } from "@/lib/db";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

const leadStatusLabels = {
  QUALIFIED: "Qualificado",
  WON: "Convertido",
  LOST: "Perdido"
} as const;

const leadStatusLabelsZh = {
  QUALIFIED: "有效询盘",
  WON: "已成交",
  LOST: "已流失"
} as const;

function saoPauloDateTimeInput(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

export default async function AdminWhatsAppLeadsPage({ searchParams }: PageProps) {
  const [admin, params, locale] = await Promise.all([requireAdmin(), searchParams, getAdminLocale()]);
  const t = createAdminTranslator(locale);
  const localizedLeadStatusLabels = locale === "zh-CN" ? leadStatusLabelsZh : leadStatusLabels;
  const [leads, products, qualifiedCount, wonCount] = await Promise.all([
    prisma.whatsAppLead.findMany({ orderBy: { qualifiedAt: "desc" }, take: 100 }),
    prisma.product.findMany({
      where: { active: true, deletedAt: null },
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, brand: { select: { name: true } } }
    }),
    prisma.whatsAppLead.count({ where: { status: "QUALIFIED" } }),
    prisma.whatsAppLead.count({ where: { status: "WON" } })
  ]);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">{t("Vendas", "销售")}</p>
          <h1>{t("Leads do WhatsApp", "WhatsApp 询盘")}</h1>
          <p>{t("Registre apenas conversas reais. Cliques no WhatsApp continuam medidos separadamente.", "只登记真实沟通；WhatsApp 点击仍作为独立指标统计。")}</p>
        </div>
      </div>

      {params.error ? <div className="admin-feedback is-error">{params.error}</div> : null}
      {params.saved ? <div className="admin-feedback is-success">{t("Lead registrado com sucesso.", "询盘登记成功。")}</div> : null}

      <section className="admin-metric-strip admin-metric-strip-compact" aria-label={t("Resumo de leads", "询盘摘要")}>
        <div><span><MessageCircleMore size={17} /> {t("Registrados", "已登记")}</span><strong>{leads.length}</strong><small>{t("100 mais recentes", "最近 100 条")}</small></div>
        <div><span><UserCheck size={17} /> {t("Qualificados", "有效询盘")}</span><strong>{qualifiedCount}</strong><small>{t("Aguardando evolução", "等待跟进")}</small></div>
        <div><span><TrendingUp size={17} /> {t("Convertidos", "已成交")}</span><strong>{wonCount}</strong><small>{t("Marcados manualmente", "人工标记")}</small></div>
      </section>

      <section className="admin-work-surface admin-lead-entry">
        <div className="admin-section-heading">
          <div><span>{t("Novo registro", "新记录")}</span><h2>{t("Adicionar consulta recebida", "登记收到的询盘")}</h2></div>
          <small>{t("Campos com * são obrigatórios", "带 * 的字段为必填项")}</small>
        </div>
        <form action={createWhatsAppLeadAction} className="admin-form-grid admin-lead-form">
          <label>{t("Nome", "姓名")} *<input name="contactName" maxLength={80} required /></label>
          <label>{t("WhatsApp com DDD", "WhatsApp（含区号）")} *<input name="whatsapp" inputMode="tel" placeholder="(11) 99999-9999" required /></label>
          <label>{t("Recebido em", "收到时间")} *<input type="datetime-local" name="occurredAt" defaultValue={saoPauloDateTimeInput()} required /></label>
          <label>{t("Origem", "来源")}<input name="sourceLabel" defaultValue="WhatsApp" maxLength={80} /></label>
          <label>
            {t("Produto relacionado", "关联商品")}
            <select name="productId" defaultValue="">
              <option value="">{t("Nenhum produto específico", "未关联具体商品")}</option>
              {products.map((product) => <option value={product.id} key={product.id}>{product.brand.name} · {product.name}</option>)}
            </select>
          </label>
          <label>{t("Número do pedido", "订单号")}<input name="orderNumber" placeholder="RG-..." /></label>
          <label className="admin-form-span-2">{t("Página ou campanha de origem", "来源页面或广告系列")}<input name="sourcePath" placeholder={t("/produto/... ou campanha informada pelo cliente", "/produto/... 或客户说明的广告系列")} /></label>
          <label className="admin-form-span-2">{t("Observações", "备注")}<textarea name="notes" rows={3} maxLength={1200} placeholder={t("Resumo comercial, sem documentos ou dados sensíveis.", "填写业务摘要，请勿录入证件或敏感数据。") } /></label>
          <div className="admin-form-actions admin-form-span-2"><button className="button primary" type="submit">{t("Registrar lead qualificado", "登记有效询盘")}</button></div>
        </form>
      </section>

      <section className="admin-work-surface">
        <div className="admin-section-heading"><div><span>{t("Histórico", "历史记录")}</span><h2>{t("Consultas registradas", "已登记询盘")}</h2></div><small>{leads.length} {t("registros", "条记录")}</small></div>
        {leads.length ? (
          <div className="admin-compact-table-wrap">
            <table className="admin-data-table admin-leads-table">
              <thead><tr><th>{t("Contato", "联系人")}</th><th>{t("Recebido", "收到时间")}</th><th>{t("Origem", "来源")}</th><th>{t("Referência", "关联信息")}</th><th>{t("Status", "状态")}</th><th>{t("Responsável", "负责人")}</th></tr></thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td><strong>{lead.contactName}</strong><small>{lead.whatsapp}</small></td>
                    <td>{formatAdminDateTime(lead.occurredAt, t("Sem registro", "未记录"), locale)}</td>
                    <td>{lead.sourceLabel}<small>{lead.sourcePath || t("Sem página associada", "未关联页面")}</small></td>
                    <td>{lead.productNameSnapshot || lead.orderNumberSnapshot || "—"}</td>
                    <td>
                      <form action={updateWhatsAppLeadStatusAction} className="admin-inline-status-form">
                        <input type="hidden" name="id" value={lead.id} />
                        <select name="status" defaultValue={lead.status} aria-label={`Status de ${lead.contactName}`}>
                          {Object.entries(localizedLeadStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                        </select>
                        <button type="submit">{t("Salvar", "保存")}</button>
                      </form>
                    </td>
                    <td>{lead.createdByAdminEmail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty-state"><strong>{t("Nenhum lead registrado", "暂无询盘记录")}</strong><p>{t("O primeiro registro aparecerá aqui depois de uma conversa real no WhatsApp.", "发生真实 WhatsApp 沟通并登记后，记录会显示在这里。")}</p></div>}
      </section>
    </AdminShell>
  );
}
