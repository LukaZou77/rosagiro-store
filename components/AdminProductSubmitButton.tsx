"use client";

import { useFormStatus } from "react-dom";
import { useContext } from "react";
import { useAdminLanguage } from "@/components/AdminLanguageProvider";
import { AdminProductEditorStatus } from "@/components/AdminProductEditorForm";

export function AdminProductSubmitButton({ label, className = "button primary wide" }: { label: string; className?: string }) {
  const { t } = useAdminLanguage();
  const status = useFormStatus();
  const editorStatus = useContext(AdminProductEditorStatus);
  const pending = status.pending || editorStatus.pending;
  const failure = editorStatus.failure;

  return (
    <>
      {failure ? <div className="admin-notice error" role="alert">
        {failure.loginRequired ? <>
          {t("A sessão expirou. Entre novamente e volte a esta aba para salvar o produto.", "登录已过期。请重新登录，再回到此标签页保存商品。")}{" "}
          <a href="/admin/login" target="_blank" rel="noopener">{t("Entrar em nova aba", "在新标签页登录")}</a>
        </> : failure.error}
      </div> : null}
      <button className={className} disabled={pending} aria-busy={pending} type="submit">
        {pending ? t("Salvando...", "正在保存……") : label}
      </button>
    </>
  );
}
