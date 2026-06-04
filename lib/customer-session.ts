export type CustomerSessionIntent = "add_to_cart" | "checkout" | "manual";

export type CustomerSessionSummary = {
  id: string;
  name: string;
  whatsapp: string;
  whatsappDigits: string;
};

export class CustomerSessionError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatBrazilWhatsapp(whatsappDigits: string) {
  const national = whatsappDigits.startsWith("55") ? whatsappDigits.slice(2) : whatsappDigits;
  const ddd = national.slice(0, 2);
  const number = national.slice(2);

  if (number.length === 9) {
    return `+55 ${ddd} ${number.slice(0, 5)}-${number.slice(5)}`;
  }

  return `+55 ${ddd} ${number.slice(0, 4)}-${number.slice(4)}`;
}

export function normalizeBrazilWhatsapp(value: string) {
  const digits = onlyDigits(value);
  let national = "";

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    national = digits.slice(2);
  } else if (digits.length === 10 || digits.length === 11) {
    national = digits;
  }

  if (!national || national.length < 10 || national.length > 11 || /^0+$/.test(national)) {
    return null;
  }

  const ddd = national.slice(0, 2);
  const number = national.slice(2);
  if (ddd === "00" || !/^[1-9][0-9]$/.test(ddd) || !/^[0-9]{8,9}$/.test(number)) {
    return null;
  }

  const whatsappDigits = `55${national}`;
  return {
    whatsapp: formatBrazilWhatsapp(whatsappDigits),
    whatsappDigits
  };
}

export function cleanCustomerName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function parseCustomerSessionPayload(payload: unknown) {
  const data = payload as Partial<{ name: string; whatsapp: string; intent: CustomerSessionIntent }>;
  const name = cleanCustomerName(String(data.name || ""));
  const normalized = normalizeBrazilWhatsapp(String(data.whatsapp || ""));
  const intent: CustomerSessionIntent =
    data.intent === "add_to_cart" || data.intent === "checkout" || data.intent === "manual" ? data.intent : "manual";

  if (name.length < 2) {
    throw new CustomerSessionError("Informe seu nome para continuar.");
  }

  if (name.length > 80) {
    throw new CustomerSessionError("Nome muito longo. Use até 80 caracteres.");
  }

  if (!normalized) {
    throw new CustomerSessionError("Informe um WhatsApp do Brasil com DDD.");
  }

  return {
    name,
    whatsapp: normalized.whatsapp,
    whatsappDigits: normalized.whatsappDigits,
    intent
  };
}
