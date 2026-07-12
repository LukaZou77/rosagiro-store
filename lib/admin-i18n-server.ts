import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, normalizeAdminLocale } from "@/lib/admin-i18n";

export async function getAdminLocale() {
  const cookieStore = await cookies();
  return normalizeAdminLocale(cookieStore.get(ADMIN_LOCALE_COOKIE)?.value);
}
