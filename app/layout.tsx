import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { siteConfig, siteUrl } from "@/lib/site-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${siteConfig.name} | ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`
  },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: siteConfig.name,
    title: `${siteConfig.name} | ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: siteUrl(),
    images: [{ url: siteUrl(siteConfig.brandAssets.ogImage) }]
  },
  alternates: {
    canonical: siteUrl()
  },
  icons: {
    icon: [
      { url: siteConfig.brandAssets.icon64, sizes: "64x64", type: "image/png" },
      { url: siteConfig.brandAssets.icon512, sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" }
    ],
    apple: [{ url: siteConfig.brandAssets.icon180, sizes: "180x180", type: "image/png" }]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
