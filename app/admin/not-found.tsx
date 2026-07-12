import Link from "next/link";
import { SearchX } from "lucide-react";
import { createAdminTranslator } from "@/lib/admin-i18n";
import { getAdminLocale } from "@/lib/admin-i18n-server";

export default async function AdminNotFound() {
  const t = createAdminTranslator(await getAdminLocale());
  return (
    <main className="admin-error-screen">
      <section>
        <span><SearchX size={24} /></span>
        <p>{t("Área administrativa", "管理区域")}</p>
        <h1>{t("Página não encontrada", "页面不存在")}</h1>
        <Link href="/admin" prefetch={false}>{t("Voltar ao dashboard", "返回经营总览")}</Link>
      </section>
    </main>
  );
}
