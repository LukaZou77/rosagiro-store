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
