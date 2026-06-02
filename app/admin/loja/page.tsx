import Link from "next/link";
import { saveStoreProfileAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { getLaunchReadinessSnapshot, launchReadinessSignalLabels } from "@/lib/launch-readiness";
import { getStoreProfile, storeCnpjLabel, storeProfileAddress, storeTrustSignals } from "@/lib/store-profile";

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

  return (
    <AdminShell adminName={admin.name}>
      <div className="admin-heading">
        <p className="eyebrow">Loja / Confianca</p>
        <h1>Dados da loja</h1>
        <p>Edite as informacoes que aparecem na vitrine, no checkout e na pagina de confianca da Bela Viva.</p>
        <div className="admin-actions">
          <Link className="button secondary" href="/informacoes-da-loja">
            Ver pagina publica
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
              Razao social
              <input name="legalName" defaultValue={profile.legalName} required />
            </label>
            <label>
              CNPJ
              <input name="cnpj" defaultValue={profile.cnpj} placeholder="00.000.000/0000-00" />
            </label>
            <label>
              Inscricao estadual
              <input name="stateRegistration" defaultValue={profile.stateRegistration} />
            </label>
          </div>
          <label>
            Sinais de confianca
            <textarea name="trustBadges" defaultValue={trustBadges} />
          </label>
          <p className="table-note">Use | para separar os selos. Exemplo: Loja em preparacao | Atendimento por WhatsApp.</p>
        </section>

        <section className="import-panel">
          <h2>Endereco e atendimento</h2>
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
              Numero
              <input name="number" defaultValue={profile.number} />
            </label>
          </div>
          <label>
            Complemento / observacao do endereco
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
            Horario de atendimento
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
            Entrega / transportadora / excursao
            <textarea name="shippingNote" defaultValue={profile.shippingNote} />
          </label>
          <label>
            Pagamento
            <textarea name="paymentNote" defaultValue={profile.paymentNote} />
          </label>
          <label>
            Trocas e devolucoes
            <textarea name="exchangeNote" defaultValue={profile.exchangeNote} />
          </label>
          <label>
            Aviso de preparacao
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
          <div className="store-profile-preview" aria-label="Previa dos dados da loja">
            <span>Previa publica</span>
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
