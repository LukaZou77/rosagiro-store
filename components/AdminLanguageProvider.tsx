"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { Languages } from "lucide-react";
import {
  ADMIN_LOCALE_COOKIE,
  adminLocaleLabel,
  createAdminTranslator,
  type AdminLocale
} from "@/lib/admin-i18n";

type AdminLanguageContextValue = {
  locale: AdminLocale;
  pending: boolean;
  setLocale: (locale: AdminLocale) => void;
  t: ReturnType<typeof createAdminTranslator>;
};

const AdminLanguageContext = createContext<AdminLanguageContextValue | null>(null);

export function AdminLanguageProvider({
  children,
  initialLocale
}: {
  children: React.ReactNode;
  initialLocale: AdminLocale;
}) {
  const [locale, setLocaleState] = useState(initialLocale);
  const [pending, setPending] = useState(false);
  const value = useMemo<AdminLanguageContextValue>(() => ({
    locale,
    pending,
    t: createAdminTranslator(locale),
    setLocale(nextLocale) {
      if (nextLocale === locale) return;
      setPending(true);
      setLocaleState(nextLocale);
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${ADMIN_LOCALE_COOKIE}=${nextLocale}; Path=/admin; Max-Age=31536000; SameSite=Lax${secure}`;
      window.location.reload();
    }
  }), [locale, pending]);

  return <AdminLanguageContext.Provider value={value}>{children}</AdminLanguageContext.Provider>;
}

export function useAdminLanguage() {
  const context = useContext(AdminLanguageContext);
  if (!context) throw new Error("useAdminLanguage must be used within AdminLanguageProvider");
  return context;
}

export function AdminLanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, pending, setLocale, t } = useAdminLanguage();

  return (
    <div
      className={`admin-language-switch${compact ? " is-compact" : ""}${pending ? " is-pending" : ""}`}
      role="group"
      aria-label={t("Idioma do painel", "后台语言")}
      title={compact ? t(`Idioma: ${adminLocaleLabel(locale)}`, `语言：${adminLocaleLabel(locale)}`) : undefined}
    >
      <Languages size={15} aria-hidden="true" />
      <button
        className={locale === "pt-BR" ? "is-active" : ""}
        type="button"
        aria-pressed={locale === "pt-BR"}
        disabled={pending}
        onClick={() => setLocale("pt-BR")}
      >
        PT
      </button>
      <button
        className={locale === "zh-CN" ? "is-active" : ""}
        type="button"
        aria-pressed={locale === "zh-CN"}
        disabled={pending}
        onClick={() => setLocale("zh-CN")}
      >
        中文
      </button>
    </div>
  );
}
