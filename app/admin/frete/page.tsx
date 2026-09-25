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
  const futureConfigDetail = status.configured
    ? `${status.environment === "production" ? t("Produção", "正式") : "Sandbox"} · ${status.originConfigured ? formatCep(status.originCep) : t("origem não configurada", "未配置发货邮编")}`
    : t("Sem token; não é necessário no fluxo atual", "未配置令牌；当前流程不需要")

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">{t("Frete", "运费")}</p>
        <h1>{t("Frete cobrado separadamente", "运费单独收取")}</h1>
        <p>
          {t(
            "O site recebe somente o pagamento dos produtos. O atendimento calcula o frete depois da compra e faz a cobrança separadamente, fora do site, somente após a aprovação do cliente.",
            "网站只收取商品款。下单后由客服核算运费，待客户确认后再在网站外单独收取。"
          )}
        </p>
      </div>

      <section className="metric-grid compact">
        <div>
          <span>{t("Política ativa", "当前政策")}</span>
          <strong>{t("Cobrança separada", "运费另收")}</strong>
        </div>
        <div>
          <span>{t("Pagamento no site", "网站付款")}</span>
          <strong>{t("Somente produtos", "仅商品款")}</strong>
        </div>
        <div>
          <span>{t("Melhor Envio", "Melhor Envio")}</span>
          <strong>{t("Não usado no checkout", "未用于结账")}</strong>
        </div>
        <div>
          <span>{t("Configuração futura", "未来配置")}</span>
          <strong>{status.configured ? t("Disponível", "已配置") : t("Opcional", "可选")}</strong>
          <small>{futureConfigDetail}</small>
        </div>
      </section>

      <div className="admin-notice success" role="status">
        {t(
          "A configuração da Melhor Envio não é necessária para o checkout atual e não bloqueia o pagamento dos produtos. Os dados acima ficam apenas como referência para uma integração futura.",
          "当前结账不需要 Melhor Envio 配置，也不会因此阻塞商品付款。上述数据仅作为未来接入参考。"
        )}
      </div>

      <section className="admin-form-section">
        <div className="admin-heading compact">
          <p className="eyebrow">{t("Fluxo ativo", "当前流程")}</p>
          <h2>{t("Produtos no site, frete fora do site", "网站收商品款，网站外收运费")}</h2>
        </div>
        <div className="field-helper">
          <strong>1.</strong>
          <span>{t("Cliente informa o endereço e confirma que o frete será cobrado separadamente.", "客户填写收货地址，并确认运费将另行收取。")}</span>
          <strong>2.</strong>
          <span>{t("O site cria o pedido e cobra somente o valor dos produtos.", "网站创建订单并仅收取商品款。")}</span>
          <strong>3.</strong>
          <span>{t("O atendimento calcula o frete conforme o pacote e informa o valor ao cliente.", "客服根据实际包裹核算运费并告知客户。")}</span>
          <strong>4.</strong>
          <span>{t("Depois da aprovação, o frete é cobrado separadamente, fora do site, antes do envio.", "客户确认后，发货前在网站外单独收取运费。")}</span>
        </div>
      </section>
    </AdminShell>
  );
}
