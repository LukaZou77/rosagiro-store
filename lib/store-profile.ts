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
  exchangeNote: string;
  trustBadges: string[];
  launchNote: string;
};

export const defaultStoreProfile = {
  id: STORE_PROFILE_ID,
  storeName: "Bela Viva",
  legalName: "Bela Viva Comercio de Beleza Ltda.",
  cnpj: "00.000.000/0000-00",
  stateRegistration: "Isento ou a ajustar",
  cep: "00000-000",
  state: "SP",
  city: "Sao Paulo",
  district: "A ajustar",
  street: "Endereco em preparacao",
  number: "S/N",
  complement: "Dados comerciais serao revisados antes da publicacao.",
  email: "contato@belaviva.local",
  whatsapp: "+55 11 90000-0000",
  businessHours: "Segunda a sexta, 9h as 18h",
  instagramUrl: "",
  facebookUrl: "",
  tiktokUrl: "",
  pickupNote: "Retirada local mediante confirmacao pelo atendimento.",
  shippingNote: "Anjun D2D Pickup, transportadora e excursao serao confirmadas antes do envio.",
  paymentNote: "Pix, cartao e pagamento simulado estao preparados para a fase de testes.",
  exchangeNote: "Trocas e devolucoes seguem politica propria antes da publicacao oficial.",
  trustBadges: ["Loja em preparacao", "Atendimento por WhatsApp", "Pedido minimo sinalizado"],
  launchNote: "Ambiente em preparacao: pedidos e pagamentos desta versao sao simulados."
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
  return digits.length === 14 && !/^0+$/.test(digits) ? `CNPJ ${profile.cnpj}` : "CNPJ em revisao";
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
    "Politicas de troca e entrega visiveis"
  ].filter(Boolean);

  return Array.from(new Set(signals)).slice(0, limit);
}
