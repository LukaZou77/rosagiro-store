import { updateLaunchReadinessItemAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluido",
  BLOCKED: "Bloqueado"
};

const statusDescriptions: Record<string, string> = {
  PENDING: "Ainda precisa ser resolvido antes da venda real.",
  IN_PROGRESS: "Ja esta em preparacao ou aguardando validacao.",
  DONE: "Conferido e pronto para a proxima etapa.",
  BLOCKED: "Precisa de decisao, conta externa, dado real ou fornecedor."
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function groupByReadiness<T extends { group: string }>(items: T[]) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    groups[item.group] ||= [];
    groups[item.group].push(item);
    return groups;
  }, {});
}

function priorityLabel(priority: number) {
  if (priority <= 1) return "Alta";
  if (priority === 2) return "Media";
  return "Baixa";
}

export default async function AdminLaunchReadinessPage({ searchParams }: PageProps) {
  const [admin, params, items] = await Promise.all([
    requireAdmin(),
    searchParams,
    prisma.launchReadinessItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    })
  ]);
  const saved = single(params.saved);
  const error = single(params.error);
  const total = items.length;
  const done = items.filter((item) => item.status === "DONE").length;
  const blocked = items.filter((item) => item.status === "BLOCKED").length;
  const active = items.filter((item) => item.status === "PENDING" || item.status === "IN_PROGRESS").length;
  const completion = total ? Math.round((done / total) * 100) : 0;
  const groups = groupByReadiness(items);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Prontidao / Launch</p>
        <h1>Central de lacunas antes da venda real</h1>
        <p>
          Registre o que ja foi implementado, mas ainda depende de dado real, credencial, conta externa,
          fornecedor, politica ou revisao operacional antes de publicar a loja.
        </p>
      </div>

      {saved ? (
        <div className="admin-notice success" role="status">
          Item de prontidao atualizado.
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="metric-grid readiness-metrics">
        <div>
          <span>Progresso</span>
          <strong>{completion}%</strong>
          <small>
            {done} de {total} itens concluidos
          </small>
        </div>
        <div>
          <span>Pendentes / em andamento</span>
          <strong>{active}</strong>
          <small>Itens que ainda precisam de acao</small>
        </div>
        <div>
          <span>Bloqueados</span>
          <strong>{blocked}</strong>
          <small>Dependem de decisao, conta ou dado externo</small>
        </div>
        <div>
          <span>Uso</span>
          <strong>Interno</strong>
          <small>Esta pagina nao aparece para clientes</small>
        </div>
      </div>

      <div className="admin-notice">
        Esta central nao le nem mostra valores de `.env.local`. Use os status para controlar a preparacao; mantenha
        senhas, tokens e chaves fora do codigo.
      </div>

      <div className="readiness-groups">
        {Object.entries(groups).map(([group, groupItems]) => (
          <section className="import-panel readiness-group" key={group}>
            <div className="readiness-group-heading">
              <div>
                <span>{group}</span>
                <h2>{group}</h2>
              </div>
              <strong>
                {groupItems.filter((item) => item.status === "DONE").length}/{groupItems.length}
              </strong>
            </div>
            <div className="readiness-list">
              {groupItems.map((item) => (
                <form action={updateLaunchReadinessItemAction} className="readiness-item" key={item.id}>
                  <input type="hidden" name="itemKey" value={item.itemKey} />
                  <div className="readiness-item-main">
                    <div className="readiness-title-row">
                      <span className={`status-chip readiness-status ${item.status.toLowerCase().replace("_", "-")}`}>
                        {statusLabels[item.status]}
                      </span>
                      <span className="status-chip">Prioridade {priorityLabel(item.priority)}</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <small>{statusDescriptions[item.status]}</small>
                  </div>
                  <div className="readiness-controls">
                    <label>
                      Status
                      <select name="status" defaultValue={item.status}>
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Nota operacional
                      <textarea
                        name="notes"
                        defaultValue={item.notes}
                        placeholder="Anote conta, responsavel, proxima verificacao ou bloqueio. Nao cole tokens."
                      />
                    </label>
                    <button className="button secondary" type="submit">
                      Salvar item
                    </button>
                  </div>
                </form>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AdminShell>
  );
}
