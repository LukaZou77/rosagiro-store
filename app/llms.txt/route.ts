import { getCategories, getProducts } from "@/lib/catalog";
import { siteUrl } from "@/lib/site-config";
import { storeSummaryForLlms } from "@/lib/seo";
import { getStoreProfile } from "@/lib/store-profile";

export async function GET() {
  const [categories, products, profile] = await Promise.all([getCategories(), getProducts(), getStoreProfile()]);
  const store = storeSummaryForLlms(profile);
  const categoryLines = categories.map((category) => `- ${category.label}: ${siteUrl(`/categoria/${category.slug}`)}`);
  const productLines = products
    .slice(0, 12)
    .map((product) => `- ${product.name} (${product.brand.name}): ${siteUrl(`/produto/${product.slug}`)}`);
  const contactLines = [
    store.whatsapp ? `- WhatsApp: ${store.whatsapp}` : "",
    store.email ? `- Email: ${store.email}` : "",
    store.address ? `- Endereço comercial: ${store.address}` : ""
  ].filter(Boolean);

  const body = [
    "# RosaGiro",
    "",
    `${store.name} é um atacado de cosméticos em São Paulo para compras de revenda no Brasil.`,
    store.description,
    "",
    "## Principais páginas",
    `- Início: ${siteUrl("/")}`,
    `- Catálogo: ${siteUrl("/categoria/all")}`,
    `- Promoções: ${siteUrl("/promocoes")}`,
    `- Informações da loja: ${siteUrl("/informacoes-da-loja")}`,
    `- Entrega: ${siteUrl("/entrega")}`,
    `- Trocas e devoluções: ${siteUrl("/trocas-e-devolucoes")}`,
    `- Privacidade: ${siteUrl("/politica-de-privacidade")}`,
    "",
    "## Categorias",
    ...categoryLines,
    "",
    "## Produtos em destaque do catálogo",
    ...productLines,
    "",
    "## Atendimento",
    ...(contactLines.length ? contactLines : ["- Atendimento comercial disponível pelos canais publicados no site."]),
    "",
    "## Observações para agentes e buscadores",
    "- O catálogo é focado em cosméticos no atacado em São Paulo, revenda, reposição, pronta entrega e compra mínima no atacado.",
    "- Páginas administrativas, APIs, carrinho, checkout, pagamento e pedidos não devem ser usadas como fonte pública de indexação.",
    "- Consulte sitemap.xml e robots.txt para regras de rastreamento atualizadas."
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8"
    }
  });
}
