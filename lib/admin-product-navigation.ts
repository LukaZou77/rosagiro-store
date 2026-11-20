const productListPath = "/admin/produtos";
const productListFilters = ["q", "brand", "category", "status", "stock", "page"];

export function productListReturnPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith(`${productListPath}?`) || /[\\\r\n]/.test(value)) return productListPath;
  const source = new URL(value, "https://admin.invalid").searchParams;
  const filters = new URLSearchParams();
  for (const key of productListFilters) {
    const filter = source.get(key);
    if (filter) filters.set(key, filter);
  }
  return filters.size ? `${productListPath}?${filters}` : productListPath;
}

export function productEditorPath(path: string, returnTo: unknown, saved = false) {
  const query = new URLSearchParams();
  const listPath = productListReturnPath(returnTo);
  if (saved) query.set("saved", "1");
  if (listPath !== productListPath) query.set("returnTo", listPath);
  return query.size ? `${path}?${query}` : path;
}
