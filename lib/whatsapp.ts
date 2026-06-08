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

function buildHref(message: string) {
  return `${siteConfig.whatsapp.baseHref}?text=${encodeURIComponent(message)}`;
}

function stockAvailabilityLabel(quantity: number | null) {
  if (quantity === null) return "";
  return quantity > 0 ? "Disponibilidade: em estoque" : "Disponibilidade: sob consulta";
}

export function buildGeneralWhatsAppHref(source = "loja") {
  return buildHref(
    [
      siteConfig.whatsapp.messages.generalGreeting,
      `Canal: ${source}`,
      `Pedido mínimo: ${money(siteConfig.wholesale.minimumOrderCents)}`,
      "Cidade/UF: ",
      "Compra para: revenda, reposição ou uso profissional?",
      siteConfig.whatsapp.messages.generalQuestion
    ].join("\n")
  );
}

export function buildCatalogWhatsAppHref(categoryLabel: string, productCount: number) {
  return buildHref(
    [
      siteConfig.whatsapp.messages.generalGreeting,
      `Estou olhando o catálogo: ${categoryLabel}.`,
      `Produtos encontrados: ${productCount}.`,
      `Pedido mínimo: ${money(siteConfig.wholesale.minimumOrderCents)}`,
      "Cidade/UF para entrega ou retirada: ",
      "Pode me ajudar com estoque, retirada, transportadora ou excursão?"
    ].join("\n")
  );
}

export function buildProductWhatsAppHref(product: ProductContact) {
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
      "Cidade/UF para entrega ou retirada: ",
      "Compra para revenda/reposição? ",
      siteConfig.whatsapp.messages.productQuestion
    ]
      .filter(Boolean)
      .join("\n")
  );
}

export function buildCartWhatsAppHref(items: CartContactItem[], subtotalCents: number) {
  if (!items.length) return buildGeneralWhatsAppHref("carrinho vazio");

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
      "Cidade/UF para entrega ou retirada: ",
      "Compra para revenda/reposição? ",
      siteConfig.whatsapp.messages.cartQuestion
    ].join("\n")
  );
}

export function buildOrderPaymentWhatsAppHref(orderNumber: string, totalCents: number) {
  return buildHref(
    [
      siteConfig.whatsapp.messages.cartGreeting,
      `Pedido: ${orderNumber}`,
      `Total: ${money(totalCents)}`,
      "Acabei de fazer ou vou fazer o Pix.",
      "Posso enviar o comprovante por aqui para confirmação do atendimento?"
    ].join("\n")
  );
}
