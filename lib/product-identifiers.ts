const gtinLengths = new Set([8, 12, 13, 14]);

export function cleanGtin(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
}

export function isValidGtin(value: string | null | undefined) {
  const gtin = cleanGtin(value);
  if (!gtin || !gtinLengths.has(gtin.length)) return false;

  let sum = 0;
  for (let index = gtin.length - 2, position = 0; index >= 0; index -= 1, position += 1) {
    sum += Number(gtin[index]) * (position % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === Number(gtin.at(-1));
}

export function cleanMpn(value: string | null | undefined) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 100) : null;
}
