export function adminReturnPath(value: unknown) {
  if (typeof value !== "string" || /[\\\r\n]/.test(value)) return "/admin";
  try {
    const url = new URL(value, "https://admin.invalid");
    if (!value.startsWith("/") || url.origin !== "https://admin.invalid") return "/admin";
    if (url.pathname !== "/admin" && !url.pathname.startsWith("/admin/")) return "/admin";
    if (url.pathname === "/admin/login") return "/admin";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/admin";
  }
}

export function adminLoginPath(returnTo: unknown, error?: string) {
  const query = new URLSearchParams({ returnTo: adminReturnPath(returnTo) });
  if (error) query.set("error", error);
  return `/admin/login?${query}`;
}
