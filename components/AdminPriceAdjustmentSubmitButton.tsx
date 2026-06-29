"use client";

import { useFormStatus } from "react-dom";

export function AdminPriceAdjustmentSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <div className="price-adjustment-submit">
      <button className="button primary" disabled={pending} type="submit">
        {pending ? "Criando tarefa..." : "Salvar regra e aplicar em todos"}
      </button>
      {pending ? (
        <div className="admin-progress-status" role="status" aria-live="polite">
          <div className="admin-progress-status-copy">
            <strong>Preparando ajuste global</strong>
            <small>Em seguida vamos mostrar o progresso real da atualização.</small>
          </div>
          <div className="admin-progress-bar" aria-hidden="true">
            <span />
          </div>
        </div>
      ) : null}
    </div>
  );
}
