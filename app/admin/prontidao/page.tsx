import Link from "next/link";
import { updateLaunchReadinessItemAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLaunchReadinessSnapshot, launchReadinessSignalLabels } from "@/lib/launch-readiness";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluído",
  BLOCKED: "Bloqueado"
};

const statusDescriptions: Record<string, string> = {
  PENDING: "Ainda precisa ser resolvido antes da venda real.",
  IN_PROGRESS: "Já está em preparação ou aguardando validação.",
  DONE: "Conferido e pronto para a próxima etapa.",
  BLOCKED: "Precisa de decisão, conta externa, dado real ou fornecedor."
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
  if (priority === 2) return "Média";
  return "Baixa";
}

export default async function AdminLaunchReadinessPage({ searchParams }: PageProps) {
  const [admin, params, items, launchSnapshot] = await Promise.all([
    requireAdmin(),
    searchParams,
    prisma.launchReadinessItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    getLaunchReadinessSnapshot()
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
        <p className="eyebrow">Prontidão / Launch</p>
        <h1>Central de lacunas antes da venda real</h1>
        <p>
          Registre o que já foi implementado, mas ainda depende de dado real, credencial, conta externa,
          fornecedor, política ou revisão operacional antes de publicar a loja.
        </p>
      </div>

      {saved ? (
        <div className="admin-notice success" role="status">
          Item de prontidão atualizado.
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
            {done} de {total} itens concluídos
          </small>
        </div>
        <div>
          <span>Pendentes / em andamento</span>
          <strong>{active}</strong>
          <small>Itens que ainda precisam de ação</small>
        </div>
        <div>
          <span>Bloqueados</span>
          <strong>{blocked}</strong>
          <small>Dependem de decisão, conta ou dado externo</small>
        </div>
        <div>
          <span>Uso</span>
          <strong>Interno</strong>
          <small>Esta página não aparece para clientes</small>
        </div>
      </div>

      <div className="admin-notice">
        Esta central não lê nem mostra valores de `.env.local`. Use os status para controlar a preparação; mantenha
        senhas, tokens e chaves fora do código.
      </div>

      <section className="import-panel readiness-auto-checks">
        <div className="readiness-group-heading">
          <div>
            <span>Checks automáticos</span>
            <h2>Leitura atual do sistema</h2>
          </div>
          <strong>
            {launchSnapshot.readyCount}/{launchSnapshot.signals.length}
          </strong>
        </div>
        <p className="table-note">
          Estes sinais são calculados a partir de dados do banco e presença de variáveis de ambiente. Eles não alteram
          os status manuais abaixo e nunca exibem valores secretos.
        </p>
        <div className="launch-summary-grid">
          <div>
            <span>Prontos</span>
            <strong>{launchSnapshot.readyCount}</strong>
          </div>
          <div>
            <span>Para revisar</span>
            <strong>{launchSnapshot.warningCount}</strong>
          </div>
          <div>
            <span>Ação necessária</span>
            <strong>{launchSnapshot.actionRequiredCount}</strong>
          </div>
        </div>
        <div className="readiness-signal-list">
          {launchSnapshot.signals.map((signal) => (
            <Link className={`readiness-signal ${signal.status.toLowerCase().replace("_", "-")}`} href={signal.actionHref} key={signal.key}>
              <span>{launchReadinessSignalLabels[signal.status]}</span>
              <strong>{signal.label}</strong>
              <small>{signal.message}</small>
            </Link>
          ))}
        </div>
      </section>

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
                        placeholder="Anote conta, responsável, próxima verificação ou bloqueio. Não cole tokens."
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
