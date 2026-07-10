import { siteConfig } from "@/lib/site-config";

type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <span className={compact ? "brand-logo brand-logo-compact" : "brand-logo"}>
      {compact ? (
        <picture>
          <source media="(max-width: 679px)" srcSet={siteConfig.brandAssets.avatar} />
          <img
            alt={`${siteConfig.name} - ${siteConfig.tagline}`}
            className="brand-logo-responsive-image"
            decoding="async"
            fetchPriority="low"
            height="129"
            src={siteConfig.brandAssets.headerImage}
            width="660"
          />
        </picture>
      ) : (
        <img
          alt={`${siteConfig.name} - ${siteConfig.tagline}`}
          className="brand-logo-header-image"
          decoding="async"
          height="129"
          loading="lazy"
          src={siteConfig.brandAssets.headerImage}
          width="660"
        />
      )}
      <span className="brand-logo-copy" aria-hidden="true">
        <strong>{siteConfig.name}</strong>
        <small>{siteConfig.tagline}</small>
      </span>
    </span>
  );
}
