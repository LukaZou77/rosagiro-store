import type { Metadata } from "next";
import type { CatalogProduct } from "@/lib/catalog";
import { money } from "@/lib/money";
import { lowestEffectivePriceCents } from "@/lib/product-pricing";
import { siteConfig, siteUrl } from "@/lib/site-config";
import type { StoreProfileView } from "@/lib/store-profile-public";
import { storeProfileAddress, storeSocialLinks } from "@/lib/store-profile-public";

type BreadcrumbEntry = {
  name: string;
  path: string;
};

type ItemListEntry = {
  name: string;
  path: string;
};

type GuideArticleJsonLdInput = {
  slug: string;
  title: string;
  excerpt: string;
  coverImage?: string | null;
  publishedAt?: Date | null;
  updatedAt: Date;
};

function compactText(value: string, maxLength = 155) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function absoluteImageUrl(path: string | null | undefined) {
  if (!path) return siteUrl(siteConfig.brandAssets.ogImage);
  try {
    return new URL(path).toString();
  } catch {
    return siteUrl(path.startsWith("/") ? path : `/${path}`);
  }
}

function publicEmail(value: string) {
  return /(?:\.local$|@example\.|@test\.|contato@(?:rosagiro|belaviva)\.local$)/i.test(value) ? undefined : value;
}

function publicPhone(value: string) {
  return /90000|0000-0000|00000000/.test(value) ? undefined : value;
}

function publicAddress(profile: StoreProfileView) {
  const fullAddress = storeProfileAddress(profile);
  if (/preparacao|prepara\u00e7\u00e3o|a ajustar|s\/n|endereco/i.test(fullAddress)) return undefined;
  return {
    "@type": "PostalAddress",
    streetAddress: [profile.street, profile.number].filter(Boolean).join(", "),
    addressLocality: profile.city,
    addressRegion: profile.state,
    postalCode: profile.cep,
    addressCountry: "BR"
  };
}

export function publicCanonical(path = "") {
  return siteUrl(path);
}

export function noIndexMetadata(title: string, description = siteConfig.description): Metadata {
  return {
    title,
    description,
    robots: {
      index: false,
      follow: false
    }
  };
}

export function storefrontMetadata(input: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "article";
}): Metadata {
  const canonical = publicCanonical(input.path);
  const description = compactText(input.description);
  const image = absoluteImageUrl(input.image || siteConfig.brandAssets.ogImage);

  return {
    title: input.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: input.type || "website",
      locale: "pt_BR",
      siteName: siteConfig.name,
      title: input.title,
      description,
      url: canonical,
      images: [{ url: image }]
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description,
      images: [image]
    }
  };
}

export function storeJsonLd(profile: StoreProfileView) {
  const socials = storeSocialLinks(profile).map((link) => link.href);
  const email = publicEmail(profile.email);
  const telephone = publicPhone(profile.whatsapp);
  const address = publicAddress(profile);
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": siteUrl("/#store"),
    name: profile.storeName || siteConfig.name,
    url: siteUrl(),
    description: siteConfig.description,
    email,
    telephone,
    address,
    areaServed: "BR",
    sameAs: socials.length ? socials : undefined
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": siteUrl("/#website"),
    name: siteConfig.name,
    url: siteUrl(),
    inLanguage: "pt-BR",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl("/categoria/all")}?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
}

export function breadcrumbJsonLd(items: BreadcrumbEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: siteUrl(item.path)
    }))
  };
}

export function itemListJsonLd(items: ItemListEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: siteUrl(item.path)
    }))
  };
}

export function guideArticleJsonLd(article: GuideArticleJsonLdInput) {
  const url = siteUrl(`/guias/${article.slug}`);
  const publishedAt = article.publishedAt || article.updatedAt;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": siteUrl(`/guias/${article.slug}#article`),
    headline: article.title,
    description: compactText(article.excerpt, 240),
    image: article.coverImage ? [absoluteImageUrl(article.coverImage)] : undefined,
    inLanguage: "pt-BR",
    datePublished: publishedAt.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    mainEntityOfPage: url,
    publisher: {
      "@id": siteUrl("/#store")
    }
  };
}

export function productJsonLd(product: CatalogProduct) {
  const inStock = (product.inventory?.quantity || 0) > 0;
  const images = [product.image, ...product.gallery].filter(Boolean).map(absoluteImageUrl);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": siteUrl(`/produto/${product.slug}#product`),
    name: product.name,
    description: compactText(product.descriptionPt, 300),
    image: images.length ? images : [absoluteImageUrl(product.image)],
    brand: {
      "@type": "Brand",
      name: product.brand.name
    },
    category: product.category.label,
    sku: product.slug,
    offers: {
      "@type": "Offer",
      url: siteUrl(`/produto/${product.slug}`),
      priceCurrency: "BRL",
      price: (lowestEffectivePriceCents(product) / 100).toFixed(2),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@id": siteUrl("/#store")
      }
    },
    additionalProperty: [
      { "@type": "PropertyValue", name: "Volume", value: product.volume },
      { "@type": "PropertyValue", name: "Acabamento", value: product.finish },
      ...(product.weightGrams ? [{ "@type": "PropertyValue", name: "Peso", value: `${product.weightGrams} g` }] : [])
    ].filter((item) => Boolean(item.value))
  };
}

export function productMetaDescription(product: CatalogProduct) {
  const stock = (product.inventory?.quantity || 0) > 0 ? "em estoque" : "disponibilidade sob consulta";
  return compactText(
    `Compre ${product.name} da ${product.brand.name} no atacado na RosaGiro. Preço ${money(lowestEffectivePriceCents(product))}, ${stock}, pedido mínimo R$ 300,00 e atendimento pelo WhatsApp para entrega ou retirada.`
  );
}

export function categoryMetadataTitle(label: string, isAllCategory = false) {
  return isAllCategory ? "Cosméticos no atacado para revenda" : `${label} no atacado para revenda`;
}

export function categoryIntroText(label: string, count: number, isAllCategory = false) {
  const productText = `${count} ${count === 1 ? "produto" : "produtos"}`;
  if (isAllCategory) {
    return compactText(
      `Cosméticos no atacado para revenda: ${productText} de maquiagem, skincare, perfumes, cabelos e acessórios com estoque sinalizado e atendimento para lojistas.`
    );
  }
  return compactText(
    `${label} no atacado para lojistas e revendedores: ${productText} com estoque sinalizado, pedido mínimo R$ 300,00 e suporte para montar reposição.`
  );
}

export function categoryMetaDescription(label: string, count: number, isAllCategory = false) {
  if (isAllCategory) {
    return compactText(
      `Cosméticos no atacado para revenda na RosaGiro: ${count} produtos com estoque sinalizado, pedido mínimo R$ 300,00, entrega nacional e WhatsApp.`
    );
  }
  return compactText(
    `${label} no atacado para lojistas e revendedores: ${count} produtos com estoque sinalizado, pedido mínimo R$ 300,00, entrega para todo o Brasil e WhatsApp.`
  );
}

export function storeSummaryForLlms(profile: StoreProfileView) {
  const address = publicAddress(profile);
  return {
    name: profile.storeName || siteConfig.name,
    description: siteConfig.description,
    address: address ? storeProfileAddress(profile) : "",
    whatsapp: publicPhone(profile.whatsapp) || "",
    email: publicEmail(profile.email) || ""
  };
}
