import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { createAdminTranslator, type AdminLocale } from "@/lib/admin-i18n";
import { getAdminLocale } from "@/lib/admin-i18n-server";
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
const groupOptions: Array<"all" | ProductQualityGroup> = ["all", "media", "content", "wholesale", "operation", "launch"];

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusClass(status: ProductQualityStatus) {
  return `quality-${status.toLowerCase().replace("_", "-")}`;
}

const statusLabelsZh: Record<ProductQualityStatus, string> = {
  READY: "可销售",
  REVIEW: "需要复核",
  ACTION_REQUIRED: "必须处理"
};

const groupLabelsZh: Record<ProductQualityGroup, string> = {
  media: "图片",
  content: "内容",
  wholesale: "批发资料",
  operation: "运营",
  launch: "发布"
};

const issueLabelsZh: Record<string, string> = {
  "missing-primary-image": "缺少主图",
  "demo-svg-image": "仍在使用示意图",
  "gallery-too-small": "图库图片不足",
  "local-upload-storage": "本地图片需迁移",
  "weak-description": "商品描述不完整",
  "brand-data-draft": "品牌资料不完整",
  "category-data-draft": "品类描述不完整",
  "missing-wholesale-package": "缺少真实批发包装规则",
  "missing-validity-note": "保质期或批次待确认",
  "missing-purchase-note": "缺少采购备注",
  "invalid-price": "价格无效",
  "active-out-of-stock": "启用商品处于缺货状态",
  "missing-weight": "未填写重量"
};

function statusLabel(status: "all" | ProductQualityStatus, locale: AdminLocale) {
  if (status === "all") return locale === "zh-CN" ? "全部" : "Todos";
  return locale === "zh-CN" ? statusLabelsZh[status] : productQualityStatusLabels[status];
}

function groupLabel(group: "all" | ProductQualityGroup, locale: AdminLocale) {
  if (group === "all") return locale === "zh-CN" ? "全部项目" : "Todas as áreas";
  return locale === "zh-CN" ? groupLabelsZh[group] : productQualityGroupLabels[group];
}

export default async function AdminProductQualityPage({ searchParams }: PageProps) {
  const [admin, params, summary, locale] = await Promise.all([requireAdmin(), searchParams, getProductQualitySummary(), getAdminLocale()]);
  const t = createAdminTranslator(locale);
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
        <p className="eyebrow">{t("Qualidade de catálogo", "目录质量")}</p>
        <h1>{t("Produtos prontos para venda real", "商品销售准备度")}</h1>
        <p>
          {t("Veja quais fichas ainda usam imagem de protótipo, galeria curta, peso não informado ou conteúdo que precisa ser confirmado antes de publicar a loja.", "检查仍在使用示意图、图库不足、缺少重量或发布前需要确认内容的商品。")}
        </p>
      </div>

      <div className="metric-grid compact quality-metrics">
        <div>
          <span>{t("Total", "总数")}</span>
          <strong>{summary.total}</strong>
          <small>{summary.activeCount} {t("ativos", "个已启用")}</small>
        </div>
        <div>
          <span>{t("Ação necessária", "必须处理")}</span>
          <strong>{summary.actionRequiredCount}</strong>
          <small>{t("Bloqueiam venda real", "影响正常销售")}</small>
        </div>
        <div>
          <span>{t("Revisar", "需要复核")}</span>
          <strong>{summary.reviewCount}</strong>
          <small>{t("Conferências operacionais", "需要运营核对")}</small>
        </div>
        <div>
          <span>{t("Prontos", "可销售")}</span>
          <strong>{summary.readyCount}</strong>
          <small>{t("Sem alerta automático", "无自动提醒")}</small>
        </div>
      </div>

      <section className="import-panel quality-storage-note">
        <div className="readiness-group-heading">
          <div>
            <span>{t("Mídia real", "真实素材")}</span>
            <h2>{t("Fotos, peso e storage", "图片、重量和存储")}</h2>
          </div>
          <strong>{summary.svgDemoCount + summary.localUploadCount}</strong>
        </div>
        <p className="table-note">
          {summary.svgDemoCount} {t("produto(s) ainda usam SVG de protótipo;", "个商品仍使用 SVG 示意图；")} {summary.localUploadCount} {t("usam upload local. Upload local serve para desenvolvimento, mas venda real em Vercel precisa de storage persistente como S3, R2 ou Vercel Blob.", "个商品使用本地上传。本地上传只适合开发环境；正式销售需要使用 S3、R2 或 Vercel Blob 等持久存储。")}
        </p>
        <p className="table-note">
          {summary.defaultWeightCount} {t("produto(s) estão sem peso conferido. O frete usa peso técnico interno até a conferência real.", "个商品尚未核对重量；确认真实重量前，运费使用内部默认重量。")}
        </p>
        <p className="table-note">
          {summary.wholesaleIssueCount} {t("produto(s) precisam revisar caixa/atacado, validade/lote ou observacao de compra antes de vender como atacado real.", "个商品需要复核整件包装、保质期/批次或采购备注后，才能正常进行批发销售。")}
        </p>
        <p className="table-note">
          {t("A página pública do produto agora destaca ficha comercial, fotos, validade/lote, condição de atacado e atendimento. Quanto mais campos reais estiverem completos, menos o cliente precisa perguntar antes de comprar.", "商品前台页会重点展示商业资料、图片、保质期/批次、批发条件与服务信息。真实资料越完整，客户购买前需要咨询的问题越少。")}
        </p>
      </section>

      <section className="import-panel">
        <div className="readiness-group-heading">
          <div>
            <span>{t("Principais lacunas", "主要缺口")}</span>
            <h2>{t("Problemas recorrentes", "常见问题")}</h2>
          </div>
          <strong>{summary.issueCounts.length}</strong>
        </div>
        <div className="quality-issue-list">
          {summary.issueCounts.slice(0, 12).map((issue) => (
            <Link
              className={`quality-issue ${issue.severity}`}
              href={`/admin/produtos/qualidade?group=${issue.group}`}
              prefetch={false}
              key={issue.key}
            >
              <span>{groupLabel(issue.group, locale)}</span>
              <strong>{issue.count}x {locale === "zh-CN" ? issueLabelsZh[issue.key] || issue.label : issue.label}</strong>
              <small>{locale === "zh-CN" ? t("Abra o produto para revisar e corrigir este item.", "打开商品资料进行核对和修正。") : issue.message}</small>
            </Link>
          ))}
          {!summary.issueCounts.length ? (
            <div className="admin-notice success">{t("Nenhum alerta automático encontrado no catálogo atual.", "当前商品目录未发现自动提醒。")}</div>
          ) : null}
        </div>
      </section>

      <form className="filters admin-filters quality-filters" action="/admin/produtos/qualidade">
        <label>
          {t("Buscar", "搜索")}
          <input name="q" defaultValue={q} placeholder={t("Nome ou slug...", "商品名或 slug……")} />
        </label>
        <label>
          {t("Status", "状态")}
          <select name="status" defaultValue={status}>
            {statusOptions.map((option) => (
              <option value={option} key={option}>
                {statusLabel(option, locale)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Área", "检查项目")}
          <select name="group" defaultValue={group}>
            {groupOptions.map((option) => (
              <option value={option} key={option}>
                {groupLabel(option, locale)}
              </option>
            ))}
          </select>
        </label>
        <button className="button primary" type="submit">
          {t("Filtrar", "筛选")}
        </button>
        <Link className="button secondary" href="/admin/produtos/qualidade" prefetch={false}>
          {t("Limpar", "清除")}
        </Link>
      </form>

      <div className="admin-list quality-product-list">
        {filteredItems.map((item) => (
          <article className="admin-product-row catalog-row quality-product-row" key={item.slug}>
            <img src={item.primaryImage} alt={item.name} />
            <div className="admin-product-summary">
              <div>
                <span className={`status-chip ${statusClass(item.status)}`}>{statusLabel(item.status, locale)}</span>
                <span className="status-chip">{item.galleryCount} {t("foto(s)", "张图片")}</span>
                <span className={item.stock > 0 ? "status-chip success" : "status-chip warning"}>
                  {item.stock > 0 ? t("Em estoque", "有货") : t("Sem estoque", "缺货")}
                </span>
              </div>
              <h2>{item.name}</h2>
              <p>{locale === "zh-CN" ? t("Revise os alertas abaixo antes de publicar ou vender.", "发布或销售前请检查下方提醒。") : item.statusMessage}</p>
              <div className="quality-row-issues">
                {item.issues.slice(0, 4).map((issue) => (
                  <span className={`quality-mini-issue ${issue.severity}`} key={issue.key}>
                    {locale === "zh-CN" ? issueLabelsZh[issue.key] || issue.label : issue.label}
                  </span>
                ))}
                {item.issues.length > 4 ? <span className="quality-mini-issue">+{item.issues.length - 4}</span> : null}
              </div>
            </div>
            <div className="admin-row-actions">
              <Link className="button secondary" href={`/produto/${item.slug}`} prefetch={false}>
                {t("Ver loja", "查看前台")}
              </Link>
              <Link className="button primary" href={`/admin/produtos/${item.slug}`} prefetch={false}>
                {t("Corrigir ficha", "修正资料")}
              </Link>
            </div>
          </article>
        ))}
        {!filteredItems.length ? (
          <div className="empty-state">
            <strong>{t("Nenhum produto nesse filtro", "该筛选条件下没有商品")}</strong>
            <p>{t("Limpe os filtros ou revise outro grupo de qualidade.", "请清除筛选条件或查看其他质量项目。")}</p>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
