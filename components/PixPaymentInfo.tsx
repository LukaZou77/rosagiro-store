import type { PublicPixPaymentAccount } from "@/lib/store-profile";
import { money } from "@/lib/money";

export function PixPaymentInfo({
  account,
  orderNumber,
  totalCents
}: {
  account: PublicPixPaymentAccount;
  orderNumber: string;
  totalCents: number;
}) {
  return (
    <div className={`pix-payment-card ${account.temporary ? "temporary" : ""}`}>
      <span>Dados para Pix</span>
      <strong>{money(totalCents)} / Pedido {orderNumber}</strong>
      <dl>
        <div>
          <dt>Chave</dt>
          <dd>
            <code>{account.key}</code>
          </dd>
        </div>
        <div>
          <dt>Tipo</dt>
          <dd>{account.keyTypeLabel}</dd>
        </div>
        <div>
          <dt>Recebedor</dt>
          <dd>{account.recipientName}</dd>
        </div>
        {account.recipientDocument ? (
          <div>
            <dt>Documento</dt>
            <dd>{account.recipientDocument}</dd>
          </div>
        ) : null}
        {account.bankName ? (
          <div>
            <dt>Banco</dt>
            <dd>{account.bankName}</dd>
          </div>
        ) : null}
      </dl>
      <p>{account.instructions}</p>
      {account.temporary ? (
        <small>
          Esta conta Pix está configurada como temporária. Confira o nome do recebedor no app do banco antes de pagar.
        </small>
      ) : null}
    </div>
  );
}
