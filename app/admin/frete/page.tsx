import { AdminFreightImportClient } from "@/components/AdminFreightImportClient";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { shippingConfig } from "@/lib/shipping";

export default async function AdminFreightPage() {
  const [admin, latestBatch] = await Promise.all([
    requireAdmin(),
    prisma.shippingRateImport.findFirst({
      where: { carrier: shippingConfig.carrier, service: shippingConfig.service },
      orderBy: { createdAt: "desc" }
    })
  ]);
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
        <p className="eyebrow">Frete</p>
        <h1>Tabela Anjun D2D Pickup</h1>
        <p>
          Importe a planilha XLSX para simular frete por CEP e peso. Esta fase nao compra etiqueta, nao chama API real e
          nao cobra seguro ou impostos automaticamente.
        </p>
      </div>

      <section className="metric-grid compact">
        <div>
          <span>Status</span>
          <strong>{latestBatch?.active ? "Ativa" : "Sem tabela"}</strong>
        </div>
        <div>
          <span>Linhas</span>
          <strong>{activeRates.toLocaleString("pt-BR")}</strong>
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
          Ultima importacao: {latestBatch.sourceName} / {latestBatch.sourceSheet} /{" "}
          {latestBatch.createdAt.toLocaleString("pt-BR")}. Origem de checkout: {shippingConfig.originDisplay}.
        </div>
      ) : (
        <div className="admin-notice error" role="alert">
          Nenhuma tabela Anjun ativa. O checkout exibira retirada local e orientara consulta manual ate a importacao.
        </div>
      )}

      <AdminFreightImportClient />
    </AdminShell>
  );
}
