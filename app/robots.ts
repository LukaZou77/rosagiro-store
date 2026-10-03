import type { MetadataRoute } from "next";
import {
  ROBOTS_ALLOWED_CRAWLER_USER_AGENTS,
  ROBOTS_BLOCKED_CRAWLER_USER_AGENTS,
  ROBOTS_PRIVATE_PATHS
} from "@/lib/crawler-policy";
import { siteUrl } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: [...ROBOTS_ALLOWED_CRAWLER_USER_AGENTS],
        allow: "/",
        disallow: [...ROBOTS_PRIVATE_PATHS]
      },
      {
        userAgent: [...ROBOTS_BLOCKED_CRAWLER_USER_AGENTS],
        disallow: "/"
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: [...ROBOTS_PRIVATE_PATHS]
      }
    ],
    sitemap: siteUrl("/sitemap.xml")
  };
}
