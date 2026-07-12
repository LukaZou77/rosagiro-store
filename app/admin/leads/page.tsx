import { MessageCircleMore, TrendingUp, UserCheck } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { createWhatsAppLeadAction, updateWhatsAppLeadStatusAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
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
  const [admin, params] = await Promise.all([requireAdmin(), searchParams]);
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
          <p className="admin-eyebrow">Vendas</p>
          <h1>Leads do WhatsApp</h1>
          <p>Registre apenas conversas reais. Cliques no WhatsApp continuam medidos separadamente.</p>
        </div>
      </div>

      {params.error ? <div className="admin-feedback is-error">{params.error}</div> : null}
      {params.saved ? <div className="admin-feedback is-success">Lead registrado com sucesso.</div> : null}

      <section className="admin-metric-strip admin-metric-strip-compact" aria-label="Resumo de leads">
        <div><span><MessageCircleMore size={17} /> Registrados</span><strong>{leads.length}</strong><small>100 mais recentes</small></div>
        <div><span><UserCheck size={17} /> Qualificados</span><strong>{qualifiedCount}</strong><small>Aguardando evolução</small></div>
        <div><span><TrendingUp size={17} /> Convertidos</span><strong>{wonCount}</strong><small>Marcados manualmente</small></div>
      </section>

      <section className="admin-work-surface admin-lead-entry">
        <div className="admin-section-heading">
          <div><span>Novo registro</span><h2>Adicionar consulta recebida</h2></div>
          <small>Campos com * são obrigatórios</small>
        </div>
        <form action={createWhatsAppLeadAction} className="admin-form-grid admin-lead-form">
          <label>Nome *<input name="contactName" maxLength={80} required /></label>
          <label>WhatsApp com DDD *<input name="whatsapp" inputMode="tel" placeholder="(11) 99999-9999" required /></label>
          <label>Recebido em *<input type="datetime-local" name="occurredAt" defaultValue={saoPauloDateTimeInput()} required /></label>
          <label>Origem<input name="sourceLabel" defaultValue="WhatsApp" maxLength={80} /></label>
          <label>
            Produto relacionado
            <select name="productId" defaultValue="">
              <option value="">Nenhum produto específico</option>
              {products.map((product) => <option value={product.id} key={product.id}>{product.brand.name} · {product.name}</option>)}
            </select>
          </label>
          <label>Número do pedido<input name="orderNumber" placeholder="RG-..." /></label>
          <label className="admin-form-span-2">Página ou campanha de origem<input name="sourcePath" placeholder="/produto/... ou campanha informada pelo cliente" /></label>
          <label className="admin-form-span-2">Observações<textarea name="notes" rows={3} maxLength={1200} placeholder="Resumo comercial, sem documentos ou dados sensíveis." /></label>
          <div className="admin-form-actions admin-form-span-2"><button className="button primary" type="submit">Registrar lead qualificado</button></div>
        </form>
      </section>

      <section className="admin-work-surface">
        <div className="admin-section-heading"><div><span>Histórico</span><h2>Consultas registradas</h2></div><small>{leads.length} registros</small></div>
        {leads.length ? (
          <div className="admin-compact-table-wrap">
            <table className="admin-data-table admin-leads-table">
              <thead><tr><th>Contato</th><th>Recebido</th><th>Origem</th><th>Referência</th><th>Status</th><th>Responsável</th></tr></thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td><strong>{lead.contactName}</strong><small>{lead.whatsapp}</small></td>
                    <td>{formatAdminDateTime(lead.occurredAt)}</td>
                    <td>{lead.sourceLabel}<small>{lead.sourcePath || "Sem página associada"}</small></td>
                    <td>{lead.productNameSnapshot || lead.orderNumberSnapshot || "—"}</td>
                    <td>
                      <form action={updateWhatsAppLeadStatusAction} className="admin-inline-status-form">
                        <input type="hidden" name="id" value={lead.id} />
                        <select name="status" defaultValue={lead.status} aria-label={`Status de ${lead.contactName}`}>
                          {Object.entries(leadStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                        </select>
                        <button type="submit">Salvar</button>
                      </form>
                    </td>
                    <td>{lead.createdByAdminEmail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty-state"><strong>Nenhum lead registrado</strong><p>O primeiro registro aparecerá aqui depois de uma conversa real no WhatsApp.</p></div>}
      </section>
    </AdminShell>
  );
}
