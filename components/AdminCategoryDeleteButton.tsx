"use client";

import { useAdminLanguage } from "@/components/AdminLanguageProvider";

type CategoryDeleteAction = (formData: FormData) => void | Promise<void>;

export function AdminCategoryDeleteButton({ action }: { action: CategoryDeleteAction }) {
  const { t } = useAdminLanguage();
  return (
    <button
      className="button secondary danger"
      type="submit"
      formAction={action}
      formNoValidate
      onClick={(event) => {
        if (!window.confirm(t("Excluir esta categoria? Esta ação não pode ser desfeita.", "删除这个品类？此操作无法撤销。"))) {
          event.preventDefault();
        }
      }}
    >
      {t("Excluir categoria", "删除品类")}
    </button>
  );
}
