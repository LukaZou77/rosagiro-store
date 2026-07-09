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
  mercadoPagoMaxInstallments: number;
  priceAdjustmentDirection: string;
  priceAdjustmentType: string;
  priceAdjustmentValue: number;
  exchangeNote: string;
  trustBadges: string[];
  launchNote: string;
};

export function storeProfileAddress(profile: StoreProfileView) {
  return [profile.street, profile.number, profile.complement, profile.district, `${profile.city} - ${profile.state}`, `CEP ${profile.cep}`]
    .filter(Boolean)
    .join(", ");
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
