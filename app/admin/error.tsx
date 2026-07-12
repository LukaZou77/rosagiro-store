"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useAdminLanguage } from "@/components/AdminLanguageProvider";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useAdminLanguage();
  return (
    <main className="admin-error-screen notranslate" translate="no">
      <section>
        <span><AlertTriangle size={24} /></span>
        <p>{t("Não foi possível carregar esta área.", "无法加载此区域。")}</p>
        <h1>{t("O painel encontrou um erro", "后台发生错误")}</h1>
        <button type="button" onClick={reset}><RotateCcw size={16} />{t("Tentar novamente", "重试")}</button>
      </section>
    </main>
  );
}
