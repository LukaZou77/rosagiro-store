import type { Metadata } from "next";
import Script from "next/script";
import { AttributionTracker } from "@/components/AttributionTracker";
import { GoogleAdsWhatsAppConversionTracker } from "@/components/GoogleAdsWhatsAppConversionTracker";
import { siteConfig, siteUrl } from "@/lib/site-config";
import "./globals.css";

const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "AW-17323505855";
const ga4MeasurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || "";

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
    images: [
      {
        url: siteUrl(siteConfig.brandAssets.ogImage),
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} - cosméticos no atacado`
      }
    ]
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
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
          strategy="afterInteractive"
        />
        <Script id="google-ads-tag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${googleAdsId}');
            ${ga4MeasurementId ? `gtag('config', '${ga4MeasurementId}');` : ""}
          `}
        </Script>
        <AttributionTracker />
        <GoogleAdsWhatsAppConversionTracker />
        {children}
      </body>
    </html>
  );
}
