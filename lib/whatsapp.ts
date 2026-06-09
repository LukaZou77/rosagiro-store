import { money } from "@/lib/money";
import { productWholesaleWhatsAppLines, type WholesaleProductDetails } from "@/lib/product-wholesale";
import { siteConfig, siteUrl } from "@/lib/site-config";

type ProductContact = {
  slug: string;
  name: string;
  priceCents: number;
  stockStatus?: string;
  volume?: string;
  brand: { name: string };
  inventory?: { quantity: number } | null;
} & WholesaleProductDetails;

type CartContactItem = {
  quantity: number;
  product: {
    name: string;
    priceCents: number;
    brand: { name: string };
  };
};

export function cleanWhatsAppPhone(phone?: string | null) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.startsWith("55") ? digits : `55${digits}`;
  return siteConfig.whatsapp.phone;
}

export function buildWhatsAppBaseHref(phone?: string | null) {
  return `https://wa.me/${cleanWhatsAppPhone(phone)}`;
}

function buildHref(message: string, phone?: string | null) {
  return `${buildWhatsAppBaseHref(phone)}?text=${encodeURIComponent(message)}`;
}

function stockAvailabilityLabel(quantity: number | null) {
  if (quantity === null) return "";
  return quantity > 0 ? "Disponibilidade: em estoque" : "Disponibilidade: sob consulta";
}

export function buildGeneralWhatsAppHref(source = "loja", phone?: string | null) {
  return buildHref(
    [
      siteConfig.whatsapp.messages.generalGreeting,
      `Canal: ${source}`,
      `Pedido mínimo: ${money(siteConfig.wholesale.minimumOrderCents)}`,
      "Cidade/UF: ",
      "Compra para: revenda, reposição ou uso profissional?",
      siteConfig.whatsapp.messages.generalQuestion
    ].join("\n"),
    phone
  );
}

export function buildCatalogWhatsAppHref(categoryLabel: string, productCount: number, phone?: string | null) {
  return buildHref(
    [
      siteConfig.whatsapp.messages.generalGreeting,
      `Estou olhando o catálogo: ${categoryLabel}.`,
      `Produtos encontrados: ${productCount}.`,
      `Pedido mínimo: ${money(siteConfig.wholesale.minimumOrderCents)}`,
      "Cidade/UF para cotação de entrega nacional ou retirada: ",
      "Pode me ajudar com estoque, frete para todo o Brasil, retirada, transportadora ou excursão?"
    ].join("\n"),
    phone
  );
}

export function buildProductWhatsAppHref(product: ProductContact, phone?: string | null) {
  const quantity = product.inventory?.quantity ?? null;
  const wholesaleLines = productWholesaleWhatsAppLines(product);
  return buildHref(
    [
      siteConfig.whatsapp.messages.productGreeting,
      `Produto: ${product.name}`,
      `Slug: ${product.slug}`,
      `Marca: ${product.brand.name}`,
      `Preço: ${money(product.priceCents)}`,
      product.volume ? `Volume: ${product.volume}` : "",
      stockAvailabilityLabel(quantity),
      product.stockStatus ? `Status: ${product.stockStatus}` : "",
      ...wholesaleLines,
      `Link: ${siteUrl(`/produto/${product.slug}`)}`,
      `Pedido mínimo: ${money(siteConfig.wholesale.minimumOrderCents)}`,
      "Cidade/UF para cotação de entrega nacional ou retirada: ",
      "Compra para revenda/reposição? ",
      siteConfig.whatsapp.messages.productQuestion
    ]
      .filter(Boolean)
      .join("\n"),
    phone
  );
}

export function buildCartWhatsAppHref(items: CartContactItem[], subtotalCents: number, phone?: string | null) {
  if (!items.length) return buildGeneralWhatsAppHref("carrinho vazio", phone);

  const missingCents = Math.max(siteConfig.wholesale.minimumOrderCents - subtotalCents, 0);
  const lines = items.map(
    (item) => `- ${item.quantity}x ${item.product.name} (${item.product.brand.name}) = ${money(item.product.priceCents * item.quantity)}`
  );

  return buildHref(
    [
      siteConfig.whatsapp.messages.cartGreeting,
      ...lines,
      `Subtotal do carrinho: ${money(subtotalCents)}`,
      `Pedido mínimo: ${money(siteConfig.wholesale.minimumOrderCents)}`,
      missingCents > 0 ? `Ainda faltam: ${money(missingCents)}` : "Lista acima do mínimo sugerido.",
      "Cidade/UF para cotação de entrega nacional ou retirada: ",
      "Compra para revenda/reposição? ",
      siteConfig.whatsapp.messages.cartQuestion
    ].join("\n"),
    phone
  );
}

export function buildOrderPaymentWhatsAppHref(orderNumber: string, totalCents: number, phone?: string | null) {
  return buildHref(
    [
      siteConfig.whatsapp.messages.cartGreeting,
      `Pedido: ${orderNumber}`,
      `Total: ${money(totalCents)}`,
      "Acabei de fazer ou vou fazer o Pix.",
      "Posso enviar o comprovante por aqui para confirmação do atendimento?"
    ].join("\n"),
    phone
  );
}
