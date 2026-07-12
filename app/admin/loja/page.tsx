import Link from "next/link";
import { saveStoreProfileAction, updateAdminCredentialsAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { createAdminTranslator } from "@/lib/admin-i18n";
import { adminLaunchStatusLabel, localizeLaunchSignal } from "@/lib/admin-i18n-content";
import { getAdminLocale } from "@/lib/admin-i18n-server";
import { getLaunchReadinessSnapshot } from "@/lib/launch-readiness";
import { mercadoPagoInstallmentOptions } from "@/lib/payments";
import {
  getPublicPixPaymentAccount,
  getStoreProfile,
  pixAccountTypeOptions,
  pixKeyTypeOptions,
  storeCnpjLabel,
  storeProfileAddress,
  storeTrustSignals
} from "@/lib/store-profile";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminStoreProfilePage({ searchParams }: PageProps) {
  const [admin, params, profile, launchSnapshot, locale] = await Promise.all([
    requireAdmin(),
    searchParams,
    getStoreProfile(),
    getLaunchReadinessSnapshot(),
    getAdminLocale()
  ]);
  const t = createAdminTranslator(locale);
  const saved = single(params.saved);
  const error = single(params.error);
  const adminCredentialsSaved = single(params.adminCredentials);
  const trustBadges = profile.trustBadges.join(" | ");
  const storeSignals = launchSnapshot.signals
    .filter((signal) => signal.group === "Loja")
    .map((signal) => localizeLaunchSignal(signal, locale));
  const pixAccount = getPublicPixPaymentAccount(profile);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">{t("Loja / Confiança", "店铺 / 信任信息")}</p>
        <h1>{t("Dados da loja", "店铺资料")}</h1>
        <p>{t("Edite as informações que aparecem na vitrine, no checkout e na página de confiança da RosaGiro.", "编辑显示在前台、结账页和 RosaGiro 店铺信息页的资料。")}</p>
        <div className="admin-actions">
          <Link className="button secondary" href="/informacoes-da-loja" prefetch={false}>
            {t("Ver página pública", "查看前台页面")}
          </Link>
        </div>
      </div>

      {saved ? (
        <div className="admin-notice success" role="status">
          {t("Dados da loja salvos com sucesso.", "店铺资料保存成功。")}
        </div>
      ) : null}
      {adminCredentialsSaved ? (
        <div className="admin-notice success" role="status">
          {t("Acesso administrativo atualizado com sucesso.", "管理员登录信息更新成功。")}
        </div>
      ) : null}
      {error ? (
        <div className="admin-notice error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="import-panel store-placeholder-checks">
        <div className="readiness-group-heading">
          <div>
            <span>{t("Checks de loja", "店铺检查")}</span>
            <h2>{t("Dados que precisam parecer reais antes de publicar", "发布前必须确认的真实资料")}</h2>
          </div>
        </div>
        <div className="readiness-signal-list compact">
          {storeSignals.map((signal) => (
            <div className={`readiness-signal ${signal.status.toLowerCase().replace("_", "-")}`} key={signal.key}>
              <span>{adminLaunchStatusLabel(signal.status, locale)}</span>
              <strong>{signal.label}</strong>
              <small>{signal.message}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="import-panel">
        <div className="readiness-group-heading">
          <div>
            <span>Admin</span>
            <h2>{t("Acesso administrativo", "管理员登录")}</h2>
            <p className="table-note">
              {t("Altere o e-mail e a senha usados para entrar no painel. A nova senha e salva apenas como hash.", "修改后台登录邮箱和密码。新密码只会以哈希形式保存。")}
            </p>
          </div>
        </div>
        <form action={updateAdminCredentialsAction} className="form-grid">
          <label>
            {t("Nome do administrador", "管理员名称")}
            <input name="adminName" defaultValue={admin.name} autoComplete="name" />
          </label>
          <label>
            {t("E-mail de login", "登录邮箱")}
            <input name="adminEmail" type="email" defaultValue={admin.email} autoComplete="username" required />
          </label>
          <label>
            {t("Senha atual", "当前密码")}
            <input name="currentPassword" type="password" autoComplete="current-password" required />
          </label>
          <label>
            {t("Nova senha", "新密码")}
            <input name="newPassword" type="password" autoComplete="new-password" minLength={10} placeholder={t("Opcional", "选填")} />
          </label>
          <label>
            {t("Confirmar nova senha", "确认新密码")}
            <input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} placeholder={t("Repita se trocar a senha", "修改密码时请再次输入")} />
          </label>
          <div className="store-profile-preview">
            <span>{t("Seguranca", "安全")}</span>
            <strong>{t("Use uma senha forte e guarde fora do WhatsApp.", "请使用强密码，并在 WhatsApp 之外安全保存。")}</strong>
            <small>{t("Para trocar apenas o e-mail, confirme com a senha atual e deixe a nova senha em branco.", "如仅修改邮箱，请填写当前密码并将新密码留空。")}</small>
          </div>
          <button className="button primary wide" type="submit">
            {t("Salvar acesso admin", "保存管理员登录信息")}
          </button>
        </form>
      </section>

      <form action={saveStoreProfileAction} className="admin-detail-grid store-profile-editor">
        <section className="import-panel">
          <h2>{t("Identidade comercial", "商业主体")}</h2>
          <div className="form-grid">
            <label>
              {t("Nome da loja", "店铺名称")}
              <input name="storeName" defaultValue={profile.storeName} required />
            </label>
            <label>
              {t("Razão social / empresa (opcional)", "公司法定名称（选填）")}
              <input name="legalName" defaultValue={profile.legalName} placeholder={t("Preencha quando a conta PJ estiver pronta", "企业账户准备好后填写")} />
            </label>
            <label>
              CNPJ
              <input name="cnpj" defaultValue={profile.cnpj} placeholder="00.000.000/0000-00" />
            </label>
            <label>
              {t("Inscrição estadual", "州税务登记号")}
              <input name="stateRegistration" defaultValue={profile.stateRegistration} />
            </label>
          </div>
          <label>
            {t("Sinais de confiança", "信任信息")}
            <textarea name="trustBadges" defaultValue={trustBadges} />
          </label>
          <p className="table-note">{t("Use | para separar os selos. Exemplo: Loja em preparação | Atendimento por WhatsApp.", "使用 | 分隔多个标签。例如：Loja em preparação | Atendimento por WhatsApp。")}</p>
        </section>

        <section className="import-panel">
          <h2>{t("Endereço e atendimento", "地址与客服")}</h2>
          <div className="form-grid">
            <label>
              CEP
              <input name="cep" defaultValue={profile.cep} placeholder="00000-000" />
            </label>
            <label>
              UF
              <input name="state" defaultValue={profile.state} maxLength={2} />
            </label>
            <label>
              {t("Cidade", "城市")}
              <input name="city" defaultValue={profile.city} />
            </label>
            <label>
              {t("Bairro", "街区")}
              <input name="district" defaultValue={profile.district} />
            </label>
            <label>
              {t("Rua", "街道")}
              <input name="street" defaultValue={profile.street} />
            </label>
            <label>
              {t("Número", "门牌号")}
              <input name="number" defaultValue={profile.number} />
            </label>
          </div>
          <label>
            {t("Complemento / observação do endereço", "地址补充说明")}
            <input name="complement" defaultValue={profile.complement || ""} />
          </label>
          <div className="form-grid">
            <label>
              WhatsApp
              <input name="whatsapp" defaultValue={profile.whatsapp} />
            </label>
            <label>
              E-mail
              <input name="email" type="email" defaultValue={profile.email} />
            </label>
          </div>
          <label>
            {t("Horário de atendimento", "客服时间")}
            <input name="businessHours" defaultValue={profile.businessHours} />
          </label>
        </section>

        <section className="import-panel">
          <h2>{t("Promessas operacionais", "运营承诺")}</h2>
          <label>
            {t("Retirada local", "到店自取")}
            <textarea name="pickupNote" defaultValue={profile.pickupNote} />
          </label>
          <label>
            {t("Entrega / transportadora / excursão", "配送 / 物流 / 大巴托运")}
            <textarea name="shippingNote" defaultValue={profile.shippingNote} />
          </label>
          <label>
            {t("Pagamento", "付款")}
            <textarea name="paymentNote" defaultValue={profile.paymentNote} />
          </label>
          <div className="admin-subpanel pix-account-admin-panel">
            <div>
              <h3>{t("Cartão de crédito / parcelamento", "银行卡 / 分期")}</h3>
              <p className="table-note">
                {t("Define o máximo de parcelas enviado ao Checkout Pro do Mercado Pago. O checkout mostra “até Xx”, sem prometer juros zero.", "设置发送给 Mercado Pago Checkout Pro 的最大分期期数。结账页显示“最多 X 期”，不会承诺免息。")}
              </p>
            </div>
            <label>
              {t("Parcelamento máximo", "最大分期期数")}
              <select name="mercadoPagoMaxInstallments" defaultValue={profile.mercadoPagoMaxInstallments}>
                {mercadoPagoInstallmentOptions.map((option) => (
                  <option value={option} key={option}>
                    {t("até", "最多")} {option}x
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="admin-subpanel pix-account-admin-panel">
            <div>
              <h3>{t("Conta Pix para recebimento manual", "人工收款 Pix 账户")}</h3>
              <p className="table-note">
                {t("Use como transição enquanto a conta PJ não fica pronta. Não coloque dados no código: ao trocar para Pix empresarial, atualize estes campos aqui.", "企业账户准备完成前可作为过渡方案。请勿把收款资料写入代码；切换到企业 Pix 后在此更新。")}
              </p>
            </div>
            <label className="checkbox-line">
              <input name="pixPaymentEnabled" type="checkbox" defaultChecked={profile.pixPaymentEnabled} /> {t("Exibir dados Pix após o cliente criar pedido com Pix", "客户创建 Pix 订单后显示收款资料")}
            </label>
            <div className="form-grid">
              <label>
                {t("Tipo de conta", "账户类型")}
                <select name="pixAccountType" defaultValue={profile.pixAccountType}>
                  {pixAccountTypeOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {locale === "zh-CN" ? option.value === "BUSINESS" ? "企业 Pix / PJ" : "临时个人 Pix" : option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("Tipo de chave", "Pix Key 类型")}
                <select name="pixKeyType" defaultValue={profile.pixKeyType}>
                  {pixKeyTypeOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {locale === "zh-CN"
                        ? option.value === "EMAIL"
                          ? "电子邮箱"
                          : option.value === "PHONE"
                            ? "手机号码"
                            : option.value === "RANDOM"
                              ? "随机 Key"
                              : option.label
                        : option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                {t("Nome do recebedor", "收款人姓名")}
                <input name="pixRecipientName" defaultValue={profile.pixRecipientName} placeholder={t("Nome exibido no Pix", "Pix 中显示的姓名")} />
              </label>
              <label>
                {t("CPF/CNPJ do recebedor", "收款人 CPF/CNPJ")}
                <input name="pixRecipientDocument" defaultValue={profile.pixRecipientDocument} placeholder={t("Opcional", "选填")} />
              </label>
            </div>
            <div className="form-grid">
              <label>
                {t("Chave Pix", "Pix Key")}
                <input name="pixKey" defaultValue={profile.pixKey} placeholder={t("CPF, e-mail, telefone ou chave aleatória", "CPF、邮箱、电话或随机 Key")} />
              </label>
              <label>
                {t("Banco / instituição", "银行 / 机构")}
                <input name="pixBankName" defaultValue={profile.pixBankName} placeholder={t("Opcional", "选填")} />
              </label>
            </div>
            <label>
              {t("Instruções para o cliente", "客户付款说明")}
              <textarea name="pixInstructions" defaultValue={profile.pixInstructions} />
            </label>
            <div className={`address-match-card admin ${pixAccount?.temporary ? "needs-review" : pixAccount ? "validated" : "disabled"}`}>
              <span>{pixAccount ? t("Pix configurado", "Pix 已配置") : t("Pix não exibido", "Pix 未显示")}</span>
              <strong>{pixAccount ? `${pixAccount.keyTypeLabel}: ${pixAccount.key}` : t("Preencha e habilite para mostrar ao cliente.", "填写并启用后才会向客户显示。")}</strong>
              <small>
                {pixAccount?.temporary
                  ? t("Conta pessoal temporária: trocar para conta PJ antes de escalar vendas.", "当前为临时个人账户；扩大销售前请切换到企业账户。")
                  : pixAccount
                    ? t("Conta empresarial pronta para conferência operacional.", "企业账户已配置，等待运营核对。")
                    : t("Sem dados Pix públicos no checkout/pagamento.", "结账和付款页不会公开 Pix 资料。")}
              </small>
            </div>
          </div>
          <label>
            {t("Trocas e devoluções", "退换货")}
            <textarea name="exchangeNote" defaultValue={profile.exchangeNote} />
          </label>
          <label>
            {t("Aviso de preparação", "准备状态提示")}
            <textarea name="launchNote" defaultValue={profile.launchNote} />
          </label>
        </section>

        <section className="import-panel">
          <h2>{t("Redes sociais", "社交媒体")}</h2>
          <div className="form-grid">
            <label>
              Instagram
              <input name="instagramUrl" defaultValue={profile.instagramUrl} placeholder="https://instagram.com/..." />
            </label>
            <label>
              Facebook
              <input name="facebookUrl" defaultValue={profile.facebookUrl} placeholder="https://facebook.com/..." />
            </label>
            <label>
              TikTok
              <input name="tiktokUrl" defaultValue={profile.tiktokUrl} placeholder="https://tiktok.com/..." />
            </label>
          </div>
          <div className="store-profile-preview" aria-label={t("Prévia dos dados da loja", "店铺资料预览")}>
            <span>{t("Prévia pública", "前台预览")}</span>
            <strong>{profile.storeName}</strong>
            <small>{storeCnpjLabel(profile)}</small>
            <small>{storeProfileAddress(profile)}</small>
            <div>
              {storeTrustSignals(profile, 4).map((signal) => (
                <em key={signal}>{signal}</em>
              ))}
            </div>
          </div>
          <button className="button primary wide" type="submit">
            {t("Salvar dados da loja", "保存店铺资料")}
          </button>
        </section>
      </form>
    </AdminShell>
  );
}
