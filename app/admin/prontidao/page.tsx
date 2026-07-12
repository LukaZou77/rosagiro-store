import Link from "next/link";
import { updateLaunchReadinessItemAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { createAdminTranslator } from "@/lib/admin-i18n";
import {
  adminLaunchGroupLabel,
  adminLaunchStatusLabel,
  localizeLaunchSignal,
  localizeReadinessItem
} from "@/lib/admin-i18n-content";
import { getAdminLocale } from "@/lib/admin-i18n-server";
import { prisma } from "@/lib/db";
import { getLaunchReadinessSnapshot } from "@/lib/launch-readiness";
import { prelaunchGoNoGoGates, prelaunchGoNoGoGatesZh, prelaunchSteps, prelaunchStepsZh } from "@/lib/prelaunch-checklist";

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

const statusLabelsZh: Record<string, string> = {
  PENDING: "待处理",
  IN_PROGRESS: "处理中",
  DONE: "已完成",
  BLOCKED: "受阻"
};

const statusDescriptionsZh: Record<string, string> = {
  PENDING: "正式销售前仍需处理。",
  IN_PROGRESS: "正在准备或等待验证。",
  DONE: "已核对，可以进入下一阶段。",
  BLOCKED: "需要决策、外部账户、真实资料或供应商配合。"
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

function priorityLabel(priority: number, chinese = false) {
  if (priority <= 1) return chinese ? "高" : "Alta";
  if (priority === 2) return chinese ? "中" : "Média";
  return chinese ? "低" : "Baixa";
}

export default async function AdminLaunchReadinessPage({ searchParams }: PageProps) {
  const [admin, params, items, launchSnapshot, locale] = await Promise.all([
    requireAdmin(),
    searchParams,
    prisma.launchReadinessItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    getLaunchReadinessSnapshot(),
    getAdminLocale()
  ]);
  const t = createAdminTranslator(locale);
  const localizedStatusLabels = locale === "zh-CN" ? statusLabelsZh : statusLabels;
  const localizedStatusDescriptions = locale === "zh-CN" ? statusDescriptionsZh : statusDescriptions;
  const saved = single(params.saved);
  const error = single(params.error);
  const total = items.length;
  const done = items.filter((item) => item.status === "DONE").length;
  const blocked = items.filter((item) => item.status === "BLOCKED").length;
  const active = items.filter((item) => item.status === "PENDING" || item.status === "IN_PROGRESS").length;
  const completion = total ? Math.round((done / total) * 100) : 0;
  const localizedItems = items.map((item) => localizeReadinessItem(item, locale));
  const groups = groupByReadiness(localizedItems);
  const localizedSignals = launchSnapshot.signals.map((signal) => localizeLaunchSignal(signal, locale));
  const localizedPrelaunchSteps = locale === "zh-CN" ? prelaunchStepsZh : prelaunchSteps;
  const localizedGoNoGoGates = locale === "zh-CN" ? prelaunchGoNoGoGatesZh : prelaunchGoNoGoGates;

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">{t("Configurações / Sistema", "设置 / 系统")}</p>
        <h1>{t("Saúde do sistema", "系统状态")}</h1>
        <p>
          {t("Acompanhe pagamentos, dados da loja e integrações essenciais. O checklist usado no lançamento continua disponível abaixo para consulta e atualização.", "检查付款、店铺资料和关键集成。上线时使用的检查清单仍保留在下方，可查看和更新。")}
        </p>
      </div>

      {saved ? (
        <div className="admin-notice success" role="status">
          {t("Item de prontidão atualizado.", "系统检查项已更新。")}
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="import-panel readiness-auto-checks">
        <div className="readiness-group-heading">
          <div>
            <span>{t("Checks automáticos", "自动检查")}</span>
            <h2>{t("Leitura atual do sistema", "当前系统检测结果")}</h2>
          </div>
          <strong>
            {launchSnapshot.readyCount}/{launchSnapshot.signals.length}
          </strong>
        </div>
        <p className="table-note">
          {t("Estes sinais são calculados a partir de dados do banco e presença de variáveis de ambiente. Eles não alteram os status manuais e nunca exibem valores secretos.", "这些信号根据数据库和环境变量是否存在自动计算，不会修改人工状态，也不会显示任何密钥值。")}
        </p>
        <div className="launch-summary-grid">
          <div>
            <span>{t("Prontos", "正常")}</span>
            <strong>{launchSnapshot.readyCount}</strong>
          </div>
          <div>
            <span>{t("Para revisar", "需要复核")}</span>
            <strong>{launchSnapshot.warningCount}</strong>
          </div>
          <div>
            <span>{t("Ação necessária", "必须处理")}</span>
            <strong>{launchSnapshot.actionRequiredCount}</strong>
          </div>
        </div>
        <div className="readiness-signal-list">
          {localizedSignals.map((signal) => (
            <Link className={`readiness-signal ${signal.status.toLowerCase().replace("_", "-")}`} href={signal.actionHref} prefetch={false} key={signal.key}>
              <span>{adminLaunchStatusLabel(signal.status, locale)}</span>
              <strong>{signal.label}</strong>
              <small>{signal.message}</small>
            </Link>
          ))}
        </div>
      </section>

      <details className="admin-system-legacy" open={Boolean(saved || error)}>
        <summary>
          <span>{t("Checklist operacional legado", "历史运营检查清单")}</span>
          <small>{active} {t("pendentes ou em andamento", "项待处理或处理中")}</small>
        </summary>
        <div className="admin-system-legacy-content">
          <div className="metric-grid readiness-metrics">
        <div>
          <span>{t("Progresso", "进度")}</span>
          <strong>{completion}%</strong>
          <small>
            {done} / {total} {t("itens concluídos", "项已完成")}
          </small>
        </div>
        <div>
          <span>{t("Pendentes / em andamento", "待处理 / 处理中")}</span>
          <strong>{active}</strong>
          <small>{t("Itens que ainda precisam de ação", "仍需处理的事项")}</small>
        </div>
        <div>
          <span>{t("Bloqueados", "受阻")}</span>
          <strong>{blocked}</strong>
          <small>{t("Dependem de decisão, conta ou dado externo", "依赖决策、账户或外部资料")}</small>
        </div>
        <div>
          <span>{t("Uso", "用途")}</span>
          <strong>{t("Interno", "内部使用")}</strong>
          <small>{t("Esta página não aparece para clientes", "客户无法看到此页面")}</small>
        </div>
          </div>

          <div className="admin-notice">
            {t("Esta central não lê nem mostra valores de `.env.local`. Use os status para controlar a preparação; mantenha senhas, tokens e chaves fora do código.", "此页面不会读取或显示 `.env.local` 的值。请用状态管理准备工作，并确保密码、令牌和密钥不写入代码。")}
          </div>

      <section className="import-panel prelaunch-sequence-panel">
        <div className="readiness-group-heading">
          <div>
            <span>{t("Roteiro de go-live", "正式上线流程")}</span>
            <h2>{t("Ordem prática para sair do local e vender de verdade", "从本地环境到正式销售的操作顺序")}</h2>
          </div>
          <strong>11 {t("passos", "步")}</strong>
        </div>
        <p className="table-note">
          {t("Siga esta ordem para não misturar dado real, pagamento, storage e deploy antes de a loja estar pronta para receber pedidos reais.", "请按此顺序执行，避免在店铺尚未准备好接收真实订单前混用真实资料、付款、存储和部署。")}
        </p>
        <div className="prelaunch-step-list">
          {localizedPrelaunchSteps.map((step) => (
            <article className="prelaunch-step" key={step.index}>
              <span className="prelaunch-step-index">{step.index}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.summary}</p>
              </div>
              <Link className="button secondary" href={step.actionHref} prefetch={false}>
                {step.actionLabel}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="import-panel prelaunch-gate-panel">
        <div className="readiness-group-heading">
          <div>
            <span>Go / No-Go</span>
            <h2>{t("Portões mínimos antes de abrir venda real", "开启真实销售前的最低门槛")}</h2>
          </div>
          <strong>{localizedGoNoGoGates.length}</strong>
        </div>
        <div className="prelaunch-gate-grid">
          {localizedGoNoGoGates.map((gate) => (
            <article className="prelaunch-gate" key={gate.label}>
              <strong>{gate.label}</strong>
              <p>{gate.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="readiness-groups">
        {Object.entries(groups).map(([group, groupItems]) => (
          <section className="import-panel readiness-group" key={group}>
            <div className="readiness-group-heading">
              <div>
                <span>{adminLaunchGroupLabel(group, locale)}</span>
                <h2>{adminLaunchGroupLabel(group, locale)}</h2>
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
                        {localizedStatusLabels[item.status]}
                      </span>
                      <span className="status-chip">{t("Prioridade", "优先级")} {priorityLabel(item.priority, locale === "zh-CN")}</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <small>{localizedStatusDescriptions[item.status]}</small>
                  </div>
                  <div className="readiness-controls">
                    <label>
                      {t("Status", "状态")}
                      <select name="status" defaultValue={item.status}>
                        {Object.entries(localizedStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t("Nota operacional", "运营备注")}
                      <textarea
                        name="notes"
                        defaultValue={item.notes}
                        placeholder={t("Anote conta, responsável, próxima verificação ou bloqueio. Não cole tokens.", "记录账户、负责人、下次检查或阻塞原因。请勿粘贴令牌。")}
                      />
                    </label>
                    <button className="button secondary" type="submit">
                      {t("Salvar item", "保存检查项")}
                    </button>
                  </div>
                </form>
              ))}
            </div>
          </section>
        ))}
      </div>
        </div>
      </details>
    </AdminShell>
  );
}
