import { siteConfig } from "@/lib/site-config";

type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <span className={compact ? "brand-logo brand-logo-compact" : "brand-logo"}>
      <img className="brand-logo-header-image" src={siteConfig.brandAssets.headerImage} alt={`${siteConfig.name} - ${siteConfig.tagline}`} />
      <img alt="" aria-hidden="true" className="brand-logo-icon" src={siteConfig.brandAssets.avatar} />
      <span className="brand-logo-copy" aria-hidden="true">
        <strong>{siteConfig.name}</strong>
        <small>{siteConfig.tagline}</small>
      </span>
    </span>
  );
}
