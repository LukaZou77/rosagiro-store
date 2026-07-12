"use client";

import { useAdminLanguage } from "@/components/AdminLanguageProvider";

type SubcategoryDeleteAction = (formData: FormData) => void | Promise<void>;

export function AdminSubcategoryDeleteButton({ action }: { action: SubcategoryDeleteAction }) {
  const { t } = useAdminLanguage();
  return (
    <button
      className="button secondary danger"
      type="submit"
      formAction={action}
      formNoValidate
      onClick={(event) => {
        if (!window.confirm(t("Excluir esta subcategoria? Esta ação não pode ser desfeita.", "删除这个子品类？此操作无法撤销。"))) {
          event.preventDefault();
        }
      }}
    >
      {t("Excluir subcategoria", "删除子品类")}
    </button>
  );
}
