import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { formatCep } from "@/lib/cep";
import { createAdminTranslator } from "@/lib/admin-i18n";
import { getAdminLocale } from "@/lib/admin-i18n-server";
import { getMelhorEnvioConfigStatus } from "@/lib/melhor-envio";

export default async function AdminFreightPage() {
  const [admin, locale] = await Promise.all([requireAdmin(), getAdminLocale()]);
  const t = createAdminTranslator(locale);
  const status = getMelhorEnvioConfigStatus();
  const productionReady = status.configured && status.environment === "production";

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">{t("Frete", "运费")}</p>
        <h1>{t("Melhor Envio", "Melhor Envio 实时运费")}</h1>
        <p>
          {t(
            "O checkout consulta transportadoras em tempo real e recalcula a opção escolhida antes de criar o pedido. Nenhuma etiqueta é comprada nesta etapa.",
            "结账页会实时查询承运商，并在创建订单前重新计算所选运费。当前阶段不会自动购买运单。"
          )}
        </p>
      </div>

      <section className="metric-grid compact">
        <div>
          <span>{t("Integração", "接口状态")}</span>
          <strong>{status.configured ? t("Configurada", "已配置") : t("Aguardando token", "等待令牌")}</strong>
        </div>
        <div>
          <span>{t("Ambiente", "环境")}</span>
          <strong>{status.environment === "production" ? t("Produção", "正式") : "Sandbox"}</strong>
        </div>
        <div>
          <span>{t("Origem", "发货邮编")}</span>
          <strong>{status.originConfigured ? formatCep(status.originCep) : "-"}</strong>
        </div>
        <div>
          <span>User-Agent</span>
          <strong>{status.userAgentConfigured ? t("Válido", "有效") : t("Revisar", "需检查")}</strong>
        </div>
      </section>

      <div className={productionReady ? "admin-notice success" : "admin-notice error"} role="status">
        {productionReady
          ? t(
              "A cotação de produção está pronta. Faça um pedido de teste antes de liberar campanhas para o checkout.",
              "正式运费报价已就绪。投放广告导向结账前，请先完成一笔测试订单。"
            )
          : t(
              "Para ativar no site, configure MELHOR_ENVIO_TOKEN e MELHOR_ENVIO_ENVIRONMENT=production na Vercel. Enquanto faltar configuração, o checkout não permite finalizar uma entrega sem preço.",
              "要在正式网站启用，请在 Vercel 配置 MELHOR_ENVIO_TOKEN 和 MELHOR_ENVIO_ENVIRONMENT=production。配置缺失时，结账不会允许客户以未计算运费的方式完成配送订单。"
            )}
      </div>

      <section className="admin-form-section">
        <div className="admin-heading compact">
          <p className="eyebrow">{t("Fluxo ativo", "当前流程")}</p>
          <h2>{t("Cotação antes do pagamento", "付款前确定运费")}</h2>
        </div>
        <div className="field-helper">
          <strong>1.</strong>
          <span>{t("Cliente informa o CEP e escolhe uma transportadora.", "客户填写邮编并选择承运商。")}</span>
          <strong>2.</strong>
          <span>{t("O servidor recalcula o serviço e inclui o frete no total.", "服务器重新报价，并把运费计入订单总额。")}</span>
          <strong>3.</strong>
          <span>{t("Mercado Pago recebe o total de produtos e frete.", "Mercado Pago 接收商品与运费合计金额。")}</span>
          <strong>4.</strong>
          <span>{t("A compra de etiqueta continua manual no painel da Melhor Envio.", "运单仍需在 Melhor Envio 后台手动购买。")}</span>
        </div>
      </section>
    </AdminShell>
  );
}
