export const ADMIN_LOCALE_COOKIE = "rosagiro_admin_locale";

export const adminLocales = ["pt-BR", "zh-CN"] as const;

export type AdminLocale = (typeof adminLocales)[number];

export function normalizeAdminLocale(value: unknown): AdminLocale {
  return value === "zh-CN" ? "zh-CN" : "pt-BR";
}

export function createAdminTranslator(locale: AdminLocale) {
  return (portuguese: string, chinese: string) => (locale === "zh-CN" ? chinese : portuguese);
}

export function adminLocaleLabel(locale: AdminLocale) {
  return locale === "zh-CN" ? "中文" : "PT-BR";
}
