import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  [
    "img-src",
    "'self'",
    "data:",
    "blob:",
    "https://*.public.blob.vercel-storage.com",
    "https://rosagiro.com.br",
    "https://www.rosagiro.com.br",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://www.google.com",
    "https://www.google.com.br",
    "https://www.googleadservices.com",
    "https://googleads.g.doubleclick.net"
  ].join(" "),
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  [
    "script-src",
    "'self'",
    "'unsafe-inline'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
    "https://www.googletagmanager.com",
    "https://www.googleadservices.com",
    "https://*.mercadopago.com",
    "https://*.mercadolivre.com"
  ].join(" "),
  [
    "connect-src",
    "'self'",
    "https://www.google-analytics.com",
    "https://*.google-analytics.com",
    "https://www.googletagmanager.com",
    "https://www.google.com",
    "https://www.google.com.br",
    "https://stats.g.doubleclick.net",
    "https://googleads.g.doubleclick.net",
    "https://*.mercadopago.com",
    "https://*.mercadolivre.com",
    "https://api.mercadopago.com"
  ].join(" "),
  [
    "frame-src",
    "'self'",
    "https://td.doubleclick.net",
    "https://*.mercadopago.com",
    "https://*.mercadolivre.com"
  ].join(" "),
  "upgrade-insecure-requests"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
  },
  { key: "X-DNS-Prefetch-Control", value: "on" }
];

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com"
      },
      {
        protocol: "https",
        hostname: "rosagiro.com.br"
      },
      {
        protocol: "https",
        hostname: "www.rosagiro.com.br"
      }
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "36mb"
    }
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" }
        ]
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" }
        ]
      }
    ];
  }
};

export default nextConfig;
