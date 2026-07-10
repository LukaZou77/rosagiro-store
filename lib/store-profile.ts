import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { STORE_PROFILE_CACHE_TAG } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { defaultMercadoPagoInstallments, normalizeMercadoPagoInstallments } from "@/lib/payments";
import { siteConfig } from "@/lib/site-config";
import type { StoreProfileView } from "@/lib/store-profile-public";

export type { StoreProfileView } from "@/lib/store-profile-public";
export { storeProfileAddress, storeSocialLinks } from "@/lib/store-profile-public";

export const STORE_PROFILE_ID = "main";

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
  legalName: "",
  cnpj: "00.000.000/0000-00",
  stateRegistration: "Isento ou a ajustar",
  cep: "00000-000",
  state: "SP",
  city: "São Paulo",
  district: "A ajustar",
  street: "Endereço a confirmar",
  number: "S/N",
  complement: "Dados comerciais serão revisados antes da publicação.",
  email: "rosagiroatacado@gmail.com",
  whatsapp: "+55 11 97079-2390",
  businessHours: "Segunda a sexta, 9h às 18h",
  instagramUrl: "",
  facebookUrl: "",
  tiktokUrl: "",
  pickupNote: "Retirada local mediante confirmação pelo atendimento.",
  shippingNote: "Enviamos para todo o Brasil com cotação por CEP. Algumas regiões podem exigir confirmação de cobertura, prazo, seguro ou taxa adicional pelo WhatsApp.",
  paymentNote: "Pix, cartão e checkout com atendimento estão disponíveis conforme a modalidade escolhida.",
  pixPaymentEnabled: false,
  pixAccountType: "TEMPORARY_PERSONAL",
  pixRecipientName: "",
  pixRecipientDocument: "",
  pixKeyType: "RANDOM",
  pixKey: "",
  pixBankName: "",
  mercadoPagoMaxInstallments: defaultMercadoPagoInstallments,
  priceAdjustmentDirection: "none",
  priceAdjustmentType: "percent",
  priceAdjustmentValue: 0,
  pixInstructions: "Finalize o pedido, faça o Pix e envie o comprovante pelo WhatsApp para confirmação do atendimento.",
  exchangeNote: "Trocas e devoluções seguem política própria antes da publicação oficial.",
  trustBadges: ["Atendimento por WhatsApp", "Entrega para todo o Brasil", "Pedido mínimo sinalizado", "Políticas visíveis"],
  launchNote: "Confira os dados da loja, canais de atendimento e políticas antes de finalizar sua compra."
} satisfies StoreProfileView;

const getStoreProfileCached = unstable_cache(async (): Promise<StoreProfileView> => {
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
}, ["store-profile"], {
  revalidate: 3600,
  tags: [STORE_PROFILE_CACHE_TAG]
});

export const getStoreProfile = cache(getStoreProfileCached);

export function configuredMercadoPagoInstallments(profile?: Pick<StoreProfileView, "mercadoPagoMaxInstallments"> | null) {
  return normalizeMercadoPagoInstallments(
    profile?.mercadoPagoMaxInstallments ?? process.env.MERCADO_PAGO_MAX_INSTALLMENTS,
    defaultMercadoPagoInstallments
  );
}

export function storeCnpjLabel(profile: StoreProfileView) {
  const digits = profile.cnpj.replace(/\D/g, "");
  return digits.length === 14 && !/^0+$/.test(digits) ? `CNPJ ${profile.cnpj}` : "Dados da loja";
}

export function publicLegalName(profile: StoreProfileView) {
  const value = profile.legalName.trim();
  if (!value) return siteConfig.businessIdentity.legalName;
  if (/bela viva|rosa giro|rosagiro.*(com[eé]rcio|cosm[eé]tico|ltda|limitada)|化妆品贸易有限公司/i.test(value)) return "";
  return value;
}

function cleanPublicSignal(signal: string) {
  const normalized = signal.trim();
  if (!normalized) return "";
  if (/preparacao|prepara\u00e7\u00e3o|teste|simulad/i.test(normalized)) return "";
  if (/cnpj em revisao|cnpj em revisão/i.test(normalized)) return "Dados da loja";
  if (/pedido minimo|pedido mínimo/i.test(normalized)) return "Pedido mínimo sinalizado";
  return normalized;
}

export function storeTrustSignals(profile: StoreProfileView, limit = 4) {
  const signals = [
    ...profile.trustBadges,
    "Entrega para todo o Brasil",
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
