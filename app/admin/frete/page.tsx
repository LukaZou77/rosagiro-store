import { AdminFreightImportClient } from "@/components/AdminFreightImportClient";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { createAdminTranslator } from "@/lib/admin-i18n";
import { getAdminLocale } from "@/lib/admin-i18n-server";
import { formatAdminDateTime } from "@/lib/date-format";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { shippingConfig } from "@/lib/shipping";

export default async function AdminFreightPage() {
  const [admin, latestBatch, locale] = await Promise.all([
    requireAdmin(),
    prisma.shippingRateImport.findFirst({
      where: { carrier: shippingConfig.carrier, service: shippingConfig.service },
      orderBy: { createdAt: "desc" }
    }),
    getAdminLocale()
  ]);
  const t = createAdminTranslator(locale);
  const activeRates = latestBatch
    ? await prisma.shippingRate.count({ where: { importId: latestBatch.id, active: true } })
    : 0;
  const sampleRate = latestBatch
    ? await prisma.shippingRate.findFirst({
        where: {
          importId: latestBatch.id,
          originKey: shippingConfig.originKey,
          cepStart: { lte: 1001000 },
          cepEnd: { gte: 1001000 },
          active: true
        }
      })
    : null;

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">{t("Frete", "运费")}</p>
        <h1>{t("Tabela Anjun D2D Pickup", "Anjun D2D Pickup 运费表")}</h1>
        <p>
          {t("Importe a planilha XLSX para simular frete por CEP e peso. Esta fase não compra etiqueta, não chama API real e não cobra seguro ou impostos automaticamente.", "导入 XLSX 表格，根据 CEP 和重量计算运费。当前阶段不会购买运单、调用真实承运商 API，也不会自动收取保险或税费。")}
        </p>
      </div>

      <section className="metric-grid compact">
        <div>
          <span>{t("Status", "状态")}</span>
          <strong>{latestBatch?.active ? t("Ativa", "已启用") : t("Sem tabela", "无运费表")}</strong>
        </div>
        <div>
          <span>{t("Linhas", "费率行数")}</span>
          <strong>{activeRates.toLocaleString(locale)}</strong>
        </div>
        <div>
          <span>UFs</span>
          <strong>{latestBatch?.stateCount || 0}</strong>
        </div>
        <div>
          <span>Amostra 01001-000</span>
          <strong>{sampleRate ? money(sampleRate.ratesCents[0] || 0) : "-"}</strong>
        </div>
      </section>

      {latestBatch ? (
        <div className="admin-notice success" role="status">
          {t("Última importação: ", "最近导入：")}{latestBatch.sourceName} / {latestBatch.sourceSheet} /{" "}
          {formatAdminDateTime(latestBatch.createdAt, t("Sem registro", "未记录"), locale)}{t(". Origem de checkout: ", "。结账发货地：")}{shippingConfig.originDisplay}{t(".", "。")}
        </div>
      ) : (
        <div className="admin-notice error" role="alert">
          {t("Nenhuma tabela Anjun ativa. O checkout exibirá retirada local e orientará consulta manual até a importação.", "当前没有启用的 Anjun 运费表。导入前，结账页会显示到店自取并提示人工咨询运费。")}
        </div>
      )}

      <AdminFreightImportClient />
    </AdminShell>
  );
}
