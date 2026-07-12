import "./admin.css";
import type { Metadata } from "next";
import { AdminLanguageProvider } from "@/components/AdminLanguageProvider";
import { getAdminLocale } from "@/lib/admin-i18n-server";

export const metadata: Metadata = {
  other: { google: "notranslate" }
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getAdminLocale();

  return (
    <AdminLanguageProvider initialLocale={locale}>
      <div className="notranslate" data-admin-locale={locale} lang={locale} translate="no">{children}</div>
    </AdminLanguageProvider>
  );
}
