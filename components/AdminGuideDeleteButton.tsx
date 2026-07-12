"use client";

import { useAdminLanguage } from "@/components/AdminLanguageProvider";

type GuideDeleteAction = (formData: FormData) => void | Promise<void>;

export function AdminGuideDeleteButton({ action }: { action: GuideDeleteAction }) {
  const { t } = useAdminLanguage();
  return (
    <button
      className="button secondary danger"
      type="submit"
      formAction={action}
      formNoValidate
      onClick={(event) => {
        if (!window.confirm(t("Excluir este guia? Esta acao nao pode ser desfeita.", "删除这篇指南？此操作无法撤销。"))) {
          event.preventDefault();
        }
      }}
    >
      {t("Excluir guia", "删除指南")}
    </button>
  );
}
