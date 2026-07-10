import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ["Googlebot", "Bingbot"],
        allow: "/",
        disallow: ["/admin", "/api"]
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
        disallow: ["/admin", "/api"]
      }
    ],
    sitemap: siteUrl("/sitemap.xml")
  };
}
