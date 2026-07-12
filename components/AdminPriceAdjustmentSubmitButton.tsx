"use client";

import { useFormStatus } from "react-dom";
import { useAdminLanguage } from "@/components/AdminLanguageProvider";

export function AdminPriceAdjustmentSubmitButton() {
  const { t } = useAdminLanguage();
  const { pending } = useFormStatus();

  return (
    <div className="price-adjustment-submit">
      <button className="button primary" disabled={pending} type="submit">
        {pending ? t("Criando tarefa...", "正在创建任务……") : t("Salvar regra e aplicar em todos", "保存规则并应用到全部商品")}
      </button>
      {pending ? (
        <div className="admin-progress-status" role="status" aria-live="polite">
          <div className="admin-progress-status-copy">
            <strong>{t("Preparando ajuste global", "正在准备全局价格调整")}</strong>
            <small>{t("Em seguida vamos mostrar o progresso real da atualização.", "下一步将显示真实更新进度。")}</small>
          </div>
          <div className="admin-progress-bar" aria-hidden="true">
            <span />
          </div>
        </div>
      ) : null}
    </div>
  );
}
