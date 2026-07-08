export const GOOGLE_ADS_WHATSAPP_CONVERSION_SEND_TO =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_WHATSAPP_CONVERSION_SEND_TO || "AW-17323505855/I2h6CKzc_cwcEL_xvsRA";

const whatsappHosts = new Set(["wa.me", "api.whatsapp.com", "web.whatsapp.com"]);

export function isWhatsAppTrackingHref(href: string) {
  try {
    const url = new URL(href, "https://rosagiro.com.br");
    return whatsappHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}
