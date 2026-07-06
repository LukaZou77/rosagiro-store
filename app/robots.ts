import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ["Googlebot", "Bingbot"],
        allow: ["/", "/categoria", "/produto", "/marcas", "/promocoes", "/guias"],
        disallow: ["/admin", "/api", "/carrinho", "/checkout", "/pedido", "/pagamento-simulado"]
      },
      {
        userAgent: [
          "GPTBot",
          "CCBot",
          "ClaudeBot",
          "PerplexityBot",
          "Bytespider",
          "PetalBot",
          "AhrefsBot",
          "SemrushBot",
          "MJ12bot"
        ],
        disallow: "/"
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/carrinho", "/checkout", "/pedido", "/pagamento-simulado"]
      }
    ],
    sitemap: siteUrl("/sitemap.xml")
  };
}
