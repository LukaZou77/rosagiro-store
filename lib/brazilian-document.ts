export const invalidBrazilianDocumentMessage = "Informe um CPF ou CNPJ válido.";

type BrazilianDocument =
  | { type: "CPF"; number: string }
  | { type: "CNPJ"; number: string; alphanumeric: boolean };

function cpfCheckDigit(base: string) {
  let sum = 0;
  for (let index = 0; index < base.length; index++) {
    sum += Number(base[index]) * (index + 10 - base.length);
  }
  const remainder = sum % 11;
  return remainder === 10 ? 0 : remainder;
}

function cnpjCheckDigit(base: string) {
  let sum = 0;
  for (let index = 0; index < base.length; index++) {
    const weight = (base.length - 1 - index) % 8 + 2;
    sum += (base.charCodeAt(index) - 48) * weight;
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function parseBrazilianDocument(value: unknown): BrazilianDocument | null {
  if (typeof value !== "string") return null;
  const input = value.trim();

  if (/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(input)) {
    const number = input.replace(/[.-]/g, "");
    if (/^(\d)\1{10}$/.test(number)) return null;
    if (cpfCheckDigit(number.slice(0, 9)) !== Number(number[9])) return null;
    if (cpfCheckDigit(number.slice(0, 10)) !== Number(number[10])) return null;
    return { type: "CPF", number };
  }

  if (/^(?:[A-Za-z0-9]{12}\d{2}|[A-Za-z0-9]{2}\.[A-Za-z0-9]{3}\.[A-Za-z0-9]{3}\/[A-Za-z0-9]{4}-\d{2})$/.test(input)) {
    const number = input.replace(/[./-]/g, "").toUpperCase();
    if (number === "00000000000000") return null;
    if (cnpjCheckDigit(number.slice(0, 12)) !== Number(number[12])) return null;
    if (cnpjCheckDigit(number.slice(0, 13)) !== Number(number[13])) return null;
    return { type: "CNPJ", number, alphanumeric: /[A-Z]/.test(number) };
  }

  return null;
}
