import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import {
  getProductQualitySummary,
  productQualityGroupLabels,
  productQualityStatusLabels,
  type ProductQualityGroup,
  type ProductQualityStatus
} from "@/lib/product-quality";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const statusOptions: Array<"all" | ProductQualityStatus> = ["all", "ACTION_REQUIRED", "REVIEW", "READY"];
const groupOptions: Array<"all" | ProductQualityGroup> = ["all", "media", "content", "wholesale", "operation", "promotion", "launch"];

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusClass(status: ProductQualityStatus) {
  return `quality-${status.toLowerCase().replace("_", "-")}`;
}

function statusLabel(status: "all" | ProductQualityStatus) {
  return status === "all" ? "Todos" : productQualityStatusLabels[status];
}

function groupLabel(group: "all" | ProductQualityGroup) {
  return group === "all" ? "Todas as areas" : productQualityGroupLabels[group];
}

export default async function AdminProductQualityPage({ searchParams }: PageProps) {
  const [admin, params, summary] = await Promise.all([requireAdmin(), searchParams, getProductQualitySummary()]);
  const q = single(params.q)?.trim().toLowerCase() || "";
  const status = statusOptions.includes(single(params.status) as ProductQualityStatus)
    ? (single(params.status) as "all" | ProductQualityStatus)
    : "all";
  const group = groupOptions.includes(single(params.group) as ProductQualityGroup)
    ? (single(params.group) as "all" | ProductQualityGroup)
    : "all";

  const filteredItems = summary.items.filter((item) => {
    const matchesQuery = q ? item.slug.includes(q) || item.name.toLowerCase().includes(q) : true;
    const matchesStatus = status === "all" ? true : item.status === status;
    const matchesGroup = group === "all" ? true : item.issues.some((issue) => issue.group === group);
    return matchesQuery && matchesStatus && matchesGroup;
  });

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Qualidade de catalogo</p>
        <h1>Produtos prontos para venda real</h1>
        <p>
          Veja quais fichas ainda usam imagem de prototipo, galeria curta, peso padrao ou conteudo que precisa ser
          confirmado antes de publicar a loja.
        </p>
        <div className="admin-actions">
          <Link className="button secondary" href="/admin/produtos">
            Voltar para produtos
          </Link>
          <Link className="button secondary" href="/admin/importar-produtos">
            Importar CSV
          </Link>
        </div>
      </div>

      <div className="metric-grid compact quality-metrics">
        <div>
          <span>Total</span>
          <strong>{summary.total}</strong>
          <small>{summary.activeCount} ativos</small>
        </div>
        <div>
          <span>Acao necessaria</span>
          <strong>{summary.actionRequiredCount}</strong>
          <small>Bloqueiam venda real</small>
        </div>
        <div>
          <span>Revisar</span>
          <strong>{summary.reviewCount}</strong>
          <small>Conferencias operacionais</small>
        </div>
        <div>
          <span>Prontos</span>
          <strong>{summary.readyCount}</strong>
          <small>Sem alerta automatico</small>
        </div>
      </div>

      <section className="import-panel quality-storage-note">
        <div className="readiness-group-heading">
          <div>
            <span>Midia real</span>
            <h2>Fotos, peso e storage</h2>
          </div>
          <strong>{summary.svgDemoCount + summary.localUploadCount}</strong>
        </div>
        <p className="table-note">
          {summary.svgDemoCount} produto(s) ainda usam SVG de prototipo; {summary.localUploadCount} usam upload local.
          Upload local serve para desenvolvimento, mas venda real em Vercel precisa de storage persistente como S3, R2
          ou Vercel Blob.
        </p>
        <p className="table-note">
          {summary.defaultWeightCount} produto(s) ainda usam 150g, que parece peso inicial. Confirme peso real para
          frete Anjun por CEP.
        </p>
        <p className="table-note">
          {summary.wholesaleIssueCount} produto(s) precisam revisar quantidade sugerida, kit, caixa/atacado ou
          validade/lote antes de vender como atacado real.
        </p>
      </section>

      <section className="import-panel">
        <div className="readiness-group-heading">
          <div>
            <span>Principais lacunas</span>
            <h2>Problemas recorrentes</h2>
          </div>
          <strong>{summary.issueCounts.length}</strong>
        </div>
        <div className="quality-issue-list">
          {summary.issueCounts.slice(0, 12).map((issue) => (
            <Link
              className={`quality-issue ${issue.severity}`}
              href={`/admin/produtos/qualidade?group=${issue.group}`}
              key={issue.key}
            >
              <span>{productQualityGroupLabels[issue.group]}</span>
              <strong>{issue.count}x {issue.label}</strong>
              <small>{issue.message}</small>
            </Link>
          ))}
          {!summary.issueCounts.length ? (
            <div className="admin-notice success">Nenhum alerta automatico encontrado no catalogo atual.</div>
          ) : null}
        </div>
      </section>

      <form className="filters admin-filters quality-filters" action="/admin/produtos/qualidade">
        <label>
          Buscar
          <input name="q" defaultValue={q} placeholder="Nome ou slug..." />
        </label>
        <label>
          Status
          <select name="status" defaultValue={status}>
            {statusOptions.map((option) => (
              <option value={option} key={option}>
                {statusLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Area
          <select name="group" defaultValue={group}>
            {groupOptions.map((option) => (
              <option value={option} key={option}>
                {groupLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <button className="button primary" type="submit">
          Filtrar
        </button>
        <Link className="button secondary" href="/admin/produtos/qualidade">
          Limpar
        </Link>
      </form>

      <div className="admin-list quality-product-list">
        {filteredItems.map((item) => (
          <article className="admin-product-row catalog-row quality-product-row" key={item.slug}>
            <img src={item.primaryImage} alt={item.name} />
            <div className="admin-product-summary">
              <div>
                <span className={`status-chip ${statusClass(item.status)}`}>{item.statusLabel}</span>
                <span className="status-chip">{item.galleryCount} foto(s)</span>
                <span className={item.stock > 0 ? "status-chip success" : "status-chip warning"}>
                  {item.stock > 0 ? `${item.stock} un.` : "Sem estoque"}
                </span>
                {item.hasRealDiscount ? <span className="status-chip success">Desconto real</span> : null}
              </div>
              <h2>{item.name}</h2>
              <p>{item.statusMessage}</p>
              <div className="quality-row-issues">
                {item.issues.slice(0, 4).map((issue) => (
                  <span className={`quality-mini-issue ${issue.severity}`} key={issue.key}>
                    {issue.label}
                  </span>
                ))}
                {item.issues.length > 4 ? <span className="quality-mini-issue">+{item.issues.length - 4}</span> : null}
              </div>
            </div>
            <div className="admin-row-actions">
              <Link className="button secondary" href={`/produto/${item.slug}`}>
                Ver loja
              </Link>
              <Link className="button primary" href={`/admin/produtos/${item.slug}`}>
                Corrigir ficha
              </Link>
            </div>
          </article>
        ))}
        {!filteredItems.length ? (
          <div className="empty-state">
            <strong>Nenhum produto nesse filtro</strong>
            <p>Limpe os filtros ou revise outro grupo de qualidade.</p>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
