export function orderListReturnPath(value: unknown) {
  if (typeof value !== "string" || /[\\\r\n]/.test(value)) return "/admin/pedidos";
  try {
    const url = new URL(value, "https://admin.invalid");
    if (!value.startsWith("/") || url.origin !== "https://admin.invalid" || url.pathname !== "/admin/pedidos") return "/admin/pedidos";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/admin/pedidos";
  }
}

export function orderDetailFeedbackPath(detailPath: string, key: "saved" | "error", value: string, returnTo: unknown) {
  const listPath = orderListReturnPath(returnTo);
  const back = listPath !== "/admin/pedidos" ? `&returnTo=${encodeURIComponent(listPath)}` : "";
  return `${detailPath}?${key}=${encodeURIComponent(value)}${back}`;
}
