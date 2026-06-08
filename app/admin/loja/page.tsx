import Link from "next/link";
import { saveStoreProfileAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { getLaunchReadinessSnapshot, launchReadinessSignalLabels } from "@/lib/launch-readiness";
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
  const [admin, params, profile, launchSnapshot] = await Promise.all([
    requireAdmin(),
    searchParams,
    getStoreProfile(),
    getLaunchReadinessSnapshot()
  ]);
  const saved = single(params.saved);
  const error = single(params.error);
  const trustBadges = profile.trustBadges.join(" | ");
  const storeSignals = launchSnapshot.signals.filter((signal) => signal.group === "Loja");
  const pixAccount = getPublicPixPaymentAccount(profile);

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Loja / Confiança</p>
        <h1>Dados da loja</h1>
        <p>Edite as informações que aparecem na vitrine, no checkout e na página de confiança da RosaGiro.</p>
        <div className="admin-actions">
          <Link className="button secondary" href="/informacoes-da-loja">
            Ver página pública
          </Link>
        </div>
      </div>

      {saved ? (
        <div className="admin-notice success" role="status">
          Dados da loja salvos com sucesso.
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
            <span>Checks de loja</span>
            <h2>Dados que precisam parecer reais antes de publicar</h2>
          </div>
        </div>
        <div className="readiness-signal-list compact">
          {storeSignals.map((signal) => (
            <div className={`readiness-signal ${signal.status.toLowerCase().replace("_", "-")}`} key={signal.key}>
              <span>{launchReadinessSignalLabels[signal.status]}</span>
              <strong>{signal.label}</strong>
              <small>{signal.message}</small>
            </div>
          ))}
        </div>
      </section>

      <form action={saveStoreProfileAction} className="admin-detail-grid store-profile-editor">
        <section className="import-panel">
          <h2>Identidade comercial</h2>
          <div className="form-grid">
            <label>
              Nome da loja
              <input name="storeName" defaultValue={profile.storeName} required />
            </label>
            <label>
              Razão social
              <input name="legalName" defaultValue={profile.legalName} required />
            </label>
            <label>
              CNPJ
              <input name="cnpj" defaultValue={profile.cnpj} placeholder="00.000.000/0000-00" />
            </label>
            <label>
              Inscrição estadual
              <input name="stateRegistration" defaultValue={profile.stateRegistration} />
            </label>
          </div>
          <label>
            Sinais de confiança
            <textarea name="trustBadges" defaultValue={trustBadges} />
          </label>
          <p className="table-note">Use | para separar os selos. Exemplo: Loja em preparação | Atendimento por WhatsApp.</p>
        </section>

        <section className="import-panel">
          <h2>Endereço e atendimento</h2>
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
              Cidade
              <input name="city" defaultValue={profile.city} />
            </label>
            <label>
              Bairro
              <input name="district" defaultValue={profile.district} />
            </label>
            <label>
              Rua
              <input name="street" defaultValue={profile.street} />
            </label>
            <label>
              Número
              <input name="number" defaultValue={profile.number} />
            </label>
          </div>
          <label>
            Complemento / observação do endereço
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
            Horário de atendimento
            <input name="businessHours" defaultValue={profile.businessHours} />
          </label>
        </section>

        <section className="import-panel">
          <h2>Promessas operacionais</h2>
          <label>
            Retirada local
            <textarea name="pickupNote" defaultValue={profile.pickupNote} />
          </label>
          <label>
            Entrega / transportadora / excursão
            <textarea name="shippingNote" defaultValue={profile.shippingNote} />
          </label>
          <label>
            Pagamento
            <textarea name="paymentNote" defaultValue={profile.paymentNote} />
          </label>
          <div className="admin-subpanel pix-account-admin-panel">
            <div>
              <h3>Conta Pix para recebimento manual</h3>
              <p className="table-note">
                Use como transição enquanto a conta PJ não fica pronta. Não coloque dados no código: ao trocar para Pix
                empresarial, atualize estes campos aqui.
              </p>
            </div>
            <label className="checkbox-line">
              <input name="pixPaymentEnabled" type="checkbox" defaultChecked={profile.pixPaymentEnabled} /> Exibir dados
              Pix após o cliente criar pedido com Pix
            </label>
            <div className="form-grid">
              <label>
                Tipo de conta
                <select name="pixAccountType" defaultValue={profile.pixAccountType}>
                  {pixAccountTypeOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo de chave
                <select name="pixKeyType" defaultValue={profile.pixKeyType}>
                  {pixKeyTypeOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                Nome do recebedor
                <input name="pixRecipientName" defaultValue={profile.pixRecipientName} placeholder="Nome exibido no Pix" />
              </label>
              <label>
                CPF/CNPJ do recebedor
                <input name="pixRecipientDocument" defaultValue={profile.pixRecipientDocument} placeholder="Opcional" />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Chave Pix
                <input name="pixKey" defaultValue={profile.pixKey} placeholder="CPF, e-mail, telefone ou chave aleatória" />
              </label>
              <label>
                Banco / instituição
                <input name="pixBankName" defaultValue={profile.pixBankName} placeholder="Opcional" />
              </label>
            </div>
            <label>
              Instruções para o cliente
              <textarea name="pixInstructions" defaultValue={profile.pixInstructions} />
            </label>
            <div className={`address-match-card admin ${pixAccount?.temporary ? "needs-review" : pixAccount ? "validated" : "disabled"}`}>
              <span>{pixAccount ? "Pix configurado" : "Pix não exibido"}</span>
              <strong>{pixAccount ? `${pixAccount.keyTypeLabel}: ${pixAccount.key}` : "Preencha e habilite para mostrar ao cliente."}</strong>
              <small>
                {pixAccount?.temporary
                  ? "Conta pessoal temporária: trocar para conta PJ antes de escalar vendas."
                  : pixAccount
                    ? "Conta empresarial pronta para conferência operacional."
                    : "Sem dados Pix públicos no checkout/pagamento."}
              </small>
            </div>
          </div>
          <label>
            Trocas e devoluções
            <textarea name="exchangeNote" defaultValue={profile.exchangeNote} />
          </label>
          <label>
            Aviso de preparação
            <textarea name="launchNote" defaultValue={profile.launchNote} />
          </label>
        </section>

        <section className="import-panel">
          <h2>Redes sociais</h2>
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
          <div className="store-profile-preview" aria-label="Prévia dos dados da loja">
            <span>Prévia pública</span>
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
            Salvar dados da loja
          </button>
        </section>
      </form>
    </AdminShell>
  );
}
