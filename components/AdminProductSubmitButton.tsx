"use client";

import { useFormStatus } from "react-dom";
import { useAdminLanguage } from "@/components/AdminLanguageProvider";

export function AdminProductSubmitButton({ label }: { label: string }) {
  const { t } = useAdminLanguage();
  const { pending } = useFormStatus();

  return (
    <button className="button primary wide" disabled={pending} type="submit">
      {pending ? t("Salvando...", "正在保存……") : label}
    </button>
  );
}
