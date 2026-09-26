const customerDisplayOverrides = new Map<string, string>([
  ["Acessorios", "Acessórios"],
  ["Acessorio", "Acessório"],
  ["Pinceis", "Pincéis"],
  ["necessaires", "nécessaires"]
]);

export function customerDisplayText(value: string) {
  const direct = customerDisplayOverrides.get(value);
  if (direct) return direct;

  return value
    .replace(/\bAcessorios\b/g, "Acessórios")
    .replace(/\bAcessorio\b/g, "Acessório")
    .replace(/\bPinceis\b/g, "Pincéis")
    .replace(/\bnecessaires\b/g, "nécessaires");
}

export function productDisplayName(name: string, brandName: string) {
  if (!/^marca n[aã]o informada$/i.test(brandName.trim())) return name;
  return name.replace(/^marca n[aã]o informada\s*[:\-]?\s+/i, "").trim() || name;
}

export function shouldDisplayProductBrand(brandName: string) {
  return Boolean(brandName.trim()) && !/^marca n[aã]o informada$/i.test(brandName.trim());
}
