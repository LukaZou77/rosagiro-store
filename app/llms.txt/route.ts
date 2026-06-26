import { getCategories, getProductCount, getProducts } from "@/lib/catalog";
import { siteConfig, siteUrl } from "@/lib/site-config";
import { storeSummaryForLlms } from "@/lib/seo";
import { getStoreProfile } from "@/lib/store-profile";

export async function GET() {
  const [categories, products, productCount, profile] = await Promise.all([
    getCategories(),
    getProducts({ take: 12 }),
    getProductCount(),
    getStoreProfile()
  ]);
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
    `- Destaques: ${siteUrl("/promocoes")}`,
    `- Informações da loja: ${siteUrl("/informacoes-da-loja")}`,
    `- Entrega: ${siteUrl("/entrega")}`,
    `- Trocas e devoluções: ${siteUrl("/trocas-e-devolucoes")}`,
    `- Privacidade: ${siteUrl("/politica-de-privacidade")}`,
    "",
    "## Categorias",
    ...categoryLines,
    "",
    "## Produtos em destaque do catálogo",
    `- Total de produtos ativos no catálogo: ${productCount}`,
    ...productLines,
    "",
    "## Atendimento",
    ...(contactLines.length ? contactLines : ["- Atendimento comercial disponível pelos canais publicados no site."]),
    "",
    "## Observações para agentes e buscadores",
    "- O catálogo é focado em cosméticos no atacado em São Paulo, revenda, reposição, disponibilidade sinalizada e compra mínima no atacado.",
    `- ${siteConfig.wholesale.nationalDeliveryText} ${siteConfig.wholesale.nationalDeliveryNote}`,
    "- Páginas administrativas, APIs, carrinho, checkout, pagamento e pedidos não devem ser usadas como fonte pública de indexação.",
    "- Consulte sitemap.xml e robots.txt para regras de rastreamento atualizadas."
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8"
    }
  });
}
