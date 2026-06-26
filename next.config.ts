import type { NextConfig } from "next";

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
  }
};

export default nextConfig;
