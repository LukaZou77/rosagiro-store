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
  packagePieces?: number | null;
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

function sourceLine(source: string) {
  const normalizedSource = source.trim();
  if (!normalizedSource || normalizedSource === "loja") return "Estou vindo pelo site da RosaGiro.";
  if (normalizedSource === "navegacao principal") return "Estou vindo pelo menu principal do site.";
  if (normalizedSource === "home atacado") return "Estou vindo pela página inicial.";
  if (normalizedSource === "destaques") return "Estou vindo pela página de destaques.";
  if (normalizedSource === "checkout sem itens") return "Estou no checkout e ainda quero montar minha lista.";
  if (normalizedSource.startsWith("guia ")) return `Estou vindo pelo guia: ${normalizedSource.replace(/^guia\s+/i, "")}.`;
  return `Estou vindo pelo site da RosaGiro: ${normalizedSource}.`;
}

function minimumOrderLine() {
  return `Pedido mínimo para atacado: ${money(siteConfig.wholesale.minimumOrderCents)}.`;
}

export function buildGeneralWhatsAppHref(source = "loja", phone?: string | null) {
  return buildHref(
    [
      siteConfig.whatsapp.messages.generalGreeting,
      sourceLine(source),
      "Quero comprar para revenda ou reposição.",
      minimumOrderLine(),
      "Minha cidade/UF: ",
      siteConfig.whatsapp.messages.generalQuestion
    ].join("\n"),
    phone
  );
}

export function buildCatalogWhatsAppHref(categoryLabel: string, productCount: number, phone?: string | null) {
  return buildHref(
    [
      "Oi, tudo bem? Estou vendo o catálogo da RosaGiro e gostaria de montar um pedido no atacado.",
      `Categoria: ${categoryLabel}.`,
      productCount > 0 ? `Vi ${productCount} produtos nessa vitrine.` : "",
      minimumOrderLine(),
      "Minha cidade/UF: ",
      "Pode me ajudar a conferir estoque e a melhor forma de entrega ou retirada?"
    ]
      .filter(Boolean)
      .join("\n"),
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
      `Marca: ${product.brand.name}`,
      `Preço unitário no site: ${money(product.priceCents)}`,
      product.volume ? `Volume: ${product.volume}` : "",
      stockAvailabilityLabel(quantity),
      ...wholesaleLines,
      `Link: ${siteUrl(`/produto/${product.slug}`)}`,
      minimumOrderLine(),
      "Minha cidade/UF: ",
      "Tenho interesse para revenda ou reposição.",
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
  const lines = items.map((item) => {
    const packagePieces = Math.floor(Number(item.packagePieces) || 0);
    const packageCount = packagePieces > 0 ? Math.floor(item.quantity / packagePieces) : 0;
    const quantityLabel = packageCount > 0
      ? `${packageCount} ${packageCount === 1 ? "embalagem fechada" : "embalagens fechadas"} (${item.quantity} unidades)`
      : `${item.quantity} unidades`;

    return `- ${quantityLabel}: ${item.product.name} (${item.product.brand.name}) = ${money(item.product.priceCents * item.quantity)}`;
  });

  return buildHref(
    [
      siteConfig.whatsapp.messages.cartGreeting,
      ...lines,
      `Subtotal da lista: ${money(subtotalCents)}`,
      minimumOrderLine(),
      missingCents > 0 ? `Ainda faltam ${money(missingCents)} para fechar o pedido mínimo.` : "A lista já passa do pedido mínimo.",
      "Minha cidade/UF: ",
      "Compra para revenda ou reposição.",
      siteConfig.whatsapp.messages.cartQuestion
    ].join("\n"),
    phone
  );
}

export function buildOrderPaymentWhatsAppHref(orderNumber: string, totalCents: number, phone?: string | null) {
  return buildHref(
    [
      "Oi, tudo bem? Fiz um pedido no site da RosaGiro e gostaria de confirmar o pagamento.",
      `Pedido: ${orderNumber}`,
      `Total: ${money(totalCents)}`,
      "Vou enviar o comprovante do Pix por aqui.",
      "Pode conferir para mim, por favor?"
    ].join("\n"),
    phone
  );
}
