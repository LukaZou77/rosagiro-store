"use client";

import { useAdminLanguage } from "@/components/AdminLanguageProvider";

type BrandDeleteAction = (formData: FormData) => void | Promise<void>;

export function AdminBrandDeleteButton({ action }: { action: BrandDeleteAction }) {
  const { t } = useAdminLanguage();
  return (
    <button
      className="button secondary danger"
      type="submit"
      formAction={action}
      formNoValidate
      onClick={(event) => {
        if (!window.confirm(t("Excluir esta marca? Esta ação não pode ser desfeita.", "删除这个品牌？此操作无法撤销。"))) {
          event.preventDefault();
        }
      }}
    >
      {t("Excluir marca", "删除品牌")}
    </button>
  );
}
