import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db";

export const STORE_PROFILE_ID = "main";

export type StoreProfileView = {
  id: string;
  storeName: string;
  legalName: string;
  cnpj: string;
  stateRegistration: string;
  cep: string;
  state: string;
  city: string;
  district: string;
  street: string;
  number: string;
  complement: string | null;
  email: string;
  whatsapp: string;
  businessHours: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  pickupNote: string;
  shippingNote: string;
  paymentNote: string;
  pixPaymentEnabled: boolean;
  pixAccountType: string;
  pixRecipientName: string;
  pixRecipientDocument: string;
  pixKeyType: string;
  pixKey: string;
  pixBankName: string;
  pixInstructions: string;
  exchangeNote: string;
  trustBadges: string[];
  launchNote: string;
};

export const pixAccountTypeOptions = [
  { value: "TEMPORARY_PERSONAL", label: "Pix pessoal temporário" },
  { value: "BUSINESS", label: "Pix empresarial / PJ" }
] as const;

export const pixKeyTypeOptions = [
  { value: "CPF", label: "CPF" },
  { value: "CNPJ", label: "CNPJ" },
  { value: "EMAIL", label: "E-mail" },
  { value: "PHONE", label: "Telefone" },
  { value: "RANDOM", label: "Chave aleatória" }
] as const;

export type PublicPixPaymentAccount = {
  accountType: string;
  accountTypeLabel: string;
  recipientName: string;
  recipientDocument: string;
  keyType: string;
  keyTypeLabel: string;
  key: string;
  bankName: string;
  instructions: string;
  temporary: boolean;
};

type PixPaymentPayload = Partial<PublicPixPaymentAccount> | null | undefined;

export const defaultStoreProfile = {
  id: STORE_PROFILE_ID,
  storeName: "RosaGiro",
  legalName: "RosaGiro Comércio de Cosméticos Ltda.",
  cnpj: "00.000.000/0000-00",
  stateRegistration: "Isento ou a ajustar",
  cep: "00000-000",
  state: "SP",
  city: "São Paulo",
  district: "A ajustar",
  street: "Endereço a confirmar",
  number: "S/N",
  complement: "Dados comerciais serão revisados antes da publicação.",
  email: "contato@rosagiro.local",
  whatsapp: "+55 11 97079-2390",
  businessHours: "Segunda a sexta, 9h às 18h",
  instagramUrl: "",
  facebookUrl: "",
  tiktokUrl: "",
  pickupNote: "Retirada local mediante confirmação pelo atendimento.",
  shippingNote: "Anjun D2D Pickup, transportadora e excursão serão confirmadas antes do envio.",
  paymentNote: "Pix, cartão e checkout com atendimento estão disponíveis conforme a modalidade escolhida.",
  pixPaymentEnabled: false,
  pixAccountType: "TEMPORARY_PERSONAL",
  pixRecipientName: "",
  pixRecipientDocument: "",
  pixKeyType: "RANDOM",
  pixKey: "",
  pixBankName: "",
  pixInstructions: "Finalize o pedido, faça o Pix e envie o comprovante pelo WhatsApp para confirmação do atendimento.",
  exchangeNote: "Trocas e devoluções seguem política própria antes da publicação oficial.",
  trustBadges: ["Atendimento por WhatsApp", "Pedido mínimo sinalizado", "Políticas visíveis"],
  launchNote: "Confira os dados da loja, canais de atendimento e políticas antes de finalizar sua compra."
} satisfies StoreProfileView;

export const getStoreProfile = cache(async (): Promise<StoreProfileView> => {
  const profile = await prisma.storeProfile.findUnique({
    where: { id: STORE_PROFILE_ID }
  });

  if (!profile) return defaultStoreProfile;

  return {
    ...defaultStoreProfile,
    ...profile,
    trustBadges:
      Array.isArray(profile.trustBadges) && profile.trustBadges.length
        ? profile.trustBadges
        : defaultStoreProfile.trustBadges
  };
});

export function storeProfileAddress(profile: StoreProfileView) {
  return [profile.street, profile.number, profile.complement, profile.district, `${profile.city} - ${profile.state}`, `CEP ${profile.cep}`]
    .filter(Boolean)
    .join(", ");
}

export function storeCnpjLabel(profile: StoreProfileView) {
  const digits = profile.cnpj.replace(/\D/g, "");
  return digits.length === 14 && !/^0+$/.test(digits) ? `CNPJ ${profile.cnpj}` : "Dados da loja";
}

function cleanPublicSignal(signal: string) {
  const normalized = signal.trim();
  if (!normalized) return "";
  if (/preparacao|prepara\u00e7\u00e3o|teste|simulad/i.test(normalized)) return "";
  if (/cnpj em revisao|cnpj em revisão/i.test(normalized)) return "Dados da loja";
  if (/pedido minimo|pedido mínimo/i.test(normalized)) return "Pedido mínimo sinalizado";
  return normalized;
}

export function storeSocialLinks(profile: StoreProfileView) {
  return [
    { label: "Instagram", href: profile.instagramUrl },
    { label: "Facebook", href: profile.facebookUrl },
    { label: "TikTok", href: profile.tiktokUrl }
  ].filter((link) => {
    try {
      const url = new URL(link.href);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  });
}

export function storeTrustSignals(profile: StoreProfileView, limit = 4) {
  const signals = [
    ...profile.trustBadges,
    storeCnpjLabel(profile),
    profile.businessHours,
    "Políticas de troca e entrega visíveis"
  ]
    .map(cleanPublicSignal)
    .filter(Boolean);

  return Array.from(new Set(signals)).slice(0, limit);
}

export function publicStoreProfileNotes(profile: StoreProfileView) {
  const paymentNote = /simulad|teste|preparacao|prepara\u00e7\u00e3o/i.test(profile.paymentNote)
    ? "Pix, cartão e confirmação pelo atendimento estão disponíveis conforme a modalidade escolhida no checkout."
    : profile.paymentNote;
  const launchNote = /simulad|teste|preparacao|prepara\u00e7\u00e3o/i.test(profile.launchNote)
    ? "Confira os dados da loja, canais de atendimento e políticas antes de finalizar sua compra."
    : profile.launchNote;
  const stateRegistration = /a ajustar|preparacao|prepara\u00e7\u00e3o/i.test(profile.stateRegistration)
    ? "Consulte a loja"
    : profile.stateRegistration;

  return {
    paymentNote,
    launchNote,
    stateRegistration
  };
}

function optionLabel(options: readonly { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label || value;
}

export function getPublicPixPaymentAccount(profile: StoreProfileView): PublicPixPaymentAccount | null {
  const key = profile.pixKey.trim();
  if (!profile.pixPaymentEnabled || !key) return null;

  const accountType = profile.pixAccountType || "TEMPORARY_PERSONAL";
  const keyType = profile.pixKeyType || "RANDOM";

  return {
    accountType,
    accountTypeLabel: optionLabel(pixAccountTypeOptions, accountType),
    recipientName: profile.pixRecipientName.trim() || profile.storeName,
    recipientDocument: profile.pixRecipientDocument.trim(),
    keyType,
    keyTypeLabel: optionLabel(pixKeyTypeOptions, keyType),
    key,
    bankName: profile.pixBankName.trim(),
    instructions: profile.pixInstructions.trim() || defaultStoreProfile.pixInstructions,
    temporary: accountType === "TEMPORARY_PERSONAL"
  };
}

export function pixPaymentAccountFromPayload(payload: unknown): PublicPixPaymentAccount | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as PixPaymentPayload;
  const key = String(data?.key || "").trim();
  if (!key) return null;

  const accountType = String(data?.accountType || "TEMPORARY_PERSONAL");
  const keyType = String(data?.keyType || "RANDOM");

  return {
    accountType,
    accountTypeLabel: String(data?.accountTypeLabel || optionLabel(pixAccountTypeOptions, accountType)),
    recipientName: String(data?.recipientName || "").trim(),
    recipientDocument: String(data?.recipientDocument || "").trim(),
    keyType,
    keyTypeLabel: String(data?.keyTypeLabel || optionLabel(pixKeyTypeOptions, keyType)),
    key,
    bankName: String(data?.bankName || "").trim(),
    instructions: String(data?.instructions || defaultStoreProfile.pixInstructions).trim(),
    temporary: Boolean(data?.temporary ?? accountType === "TEMPORARY_PERSONAL")
  };
}
