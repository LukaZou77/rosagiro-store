import type { Metadata } from "next";
import type { CatalogProduct } from "@/lib/catalog";
import { money } from "@/lib/money";
import { productQuantity } from "@/lib/product-conversion";
import { productWholesalePackagePieces, productWholesalePackagePriceCents } from "@/lib/product-wholesale";
import { productDisplayName, shouldDisplayProductBrand } from "@/lib/display-text";
import { isSourceCatalogConsultationProduct, sourceCatalogPriceLabel } from "@/lib/source-catalog-product";
import { siteConfig, siteUrl } from "@/lib/site-config";
import type { StoreProfileView } from "@/lib/store-profile-public";
import { storeSocialLinks } from "@/lib/store-profile-public";

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
  coverImageAlt?: string | null;
  authorName?: string | null;
  reviewerName?: string | null;
  reviewedAt?: Date | null;
  sourceNotes?: string | null;
  publishedAt?: Date | null;
  updatedAt: Date;
};

type CatalogIndexingInput = {
  path: string;
  page: number;
  query: string;
  brand: string;
  stockFilter: string;
  sort: string;
  totalPages: number;
};

export const MIN_INDEXABLE_BRAND_PRODUCTS = 3;
export const META_DESCRIPTION_MAX_LENGTH = 130;

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

function pickupAddress() {
  const pickup = siteConfig.pickupLocation;
  return {
    "@type": "PostalAddress",
    streetAddress: pickup.streetAddress,
    addressLocality: pickup.city,
    addressRegion: pickup.state,
    addressCountry: pickup.country
  };
}

function merchantReturnPolicyId() {
  return siteUrl("/trocas-e-devolucoes#policy");
}

function merchantReturnPolicy() {
  return {
    "@type": "MerchantReturnPolicy",
    "@id": merchantReturnPolicyId(),
    applicableCountry: "BR",
    merchantReturnLink: siteUrl("/trocas-e-devolucoes")
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
  const description = compactText(input.description, META_DESCRIPTION_MAX_LENGTH);
  const usesDefaultImage = !input.image;
  const image = absoluteImageUrl(input.image || siteConfig.brandAssets.ogImage);
  const openGraphImage = usesDefaultImage
    ? {
        url: image,
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} - cosméticos no atacado`
      }
    : { url: image };

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
      images: [openGraphImage]
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description,
      images: [image]
    }
  };
}

export function catalogIndexing(input: CatalogIndexingInput) {
  const hasFilters = Boolean(
    input.query || input.brand !== "all" || input.stockFilter !== "all" || input.sort !== "featured"
  );
  const pageOutOfRange = input.page > Math.max(1, input.totalPages);
  const canonicalPath = !hasFilters && input.page > 1 && !pageOutOfRange ? `${input.path}?page=${input.page}` : input.path;

  return {
    canonicalPath,
    shouldNoIndex: hasFilters || pageOutOfRange
  };
}

export function brandMetadataTitle(name: string, page = 1) {
  return page > 1 ? `${name} no atacado - página ${page}` : `${name} no atacado para revenda`;
}

export function brandMetaDescription(name: string, count: number, page = 1) {
  const opening = page > 1 ? `Página ${page}: ` : "";
  return compactText(
    `${opening}${name} no atacado para revenda: ${count} ${count === 1 ? "produto" : "produtos"} por embalagem fechada, pedido mínimo de ${siteConfig.wholesale.minimumOrderLabel} e entrega no Brasil.`,
    META_DESCRIPTION_MAX_LENGTH
  );
}

export function brandIntroText(name: string, count: number) {
  return compactText(
    `${count} ${count === 1 ? "produto" : "produtos"} ${name} no atacado para lojistas e revendedores. Combine embalagens fechadas no pedido mínimo de ${siteConfig.wholesale.minimumOrderLabel} e consulte a entrega por CEP.`
  );
}

export function brandDisplayDescription(value: string) {
  const description = value.replace(/\s+/g, " ").trim();
  if (!description || /a ajustar/i.test(description) || /^.+\s+no atacado RosaGiro\.?$/i.test(description)) return "";
  return description;
}

export function storeJsonLd(profile: StoreProfileView) {
  const socials = storeSocialLinks(profile).map((link) => link.href);
  const email = publicEmail(profile.email);
  const telephone = publicPhone(profile.whatsapp);
  const address = pickupAddress();
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": siteUrl("/#store"),
    name: profile.storeName || siteConfig.name,
    legalName: siteConfig.businessIdentity.legalName,
    taxID: siteConfig.businessIdentity.taxId,
    url: siteUrl(),
    description: siteConfig.description,
    email,
    telephone,
    address,
    areaServed: "BR",
    hasMerchantReturnPolicy: merchantReturnPolicy(),
    parentOrganization: {
      "@type": "Organization",
      "@id": siteUrl("/#organization"),
      name: siteConfig.businessIdentity.legalName,
      legalName: siteConfig.businessIdentity.legalName,
      taxID: siteConfig.businessIdentity.taxId,
      address: {
        "@type": "PostalAddress",
        streetAddress: siteConfig.businessIdentity.legalAddress.streetAddress,
        addressLocality: siteConfig.businessIdentity.legalAddress.city,
        addressRegion: siteConfig.businessIdentity.legalAddress.state,
        postalCode: siteConfig.businessIdentity.legalAddress.postalCode,
        addressCountry: siteConfig.businessIdentity.legalAddress.country
      },
      location: [
        {
          "@type": "Place",
          name: `Ponto de retirada - ${siteConfig.pickupLocation.name}`,
          address
        }
      ]
    },
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
  const authorName = article.authorName || siteConfig.name;
  const reviewerName = article.reviewerName || undefined;
  const isStoreAuthor = authorName === siteConfig.name || authorName === "Equipe RosaGiro";
  const isStoreReviewer = reviewerName === siteConfig.name || reviewerName === "Equipe RosaGiro";
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
    author: {
      "@type": isStoreAuthor ? "Organization" : "Person",
      name: authorName
    },
    reviewedBy: reviewerName
      ? {
          "@type": isStoreReviewer ? "Organization" : "Person",
          name: reviewerName
        }
      : undefined,
    dateReviewed: article.reviewedAt?.toISOString(),
    citation: article.sourceNotes || undefined,
    mainEntityOfPage: url,
    publisher: {
      "@id": siteUrl("/#store")
    }
  };
}

export function productJsonLd(product: CatalogProduct, canonicalSlug = product.slug) {
  const url = siteUrl(`/produto/${canonicalSlug}`);
  const consultationOnly = isSourceCatalogConsultationProduct(product);
  const packagePieces = productWholesalePackagePieces(product);
  const packagePrice = productWholesalePackagePriceCents(product);
  const inStock = productQuantity(product) > 0;
  const images = Array.from(
    new Set(
      [product.image, ...product.gallery, ...product.skus.filter((sku) => sku.active).map((sku) => sku.image)]
        .filter((image): image is string => Boolean(image))
        .map(absoluteImageUrl)
    )
  );
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": siteUrl(`/produto/${canonicalSlug}#product`),
    url,
    name: productDisplayName(product.name, product.brand.name),
    description: compactText(product.descriptionPt, 300),
    image: images.length ? images : [absoluteImageUrl(product.image)],
    brand: shouldDisplayProductBrand(product.brand.name) ? {
      "@type": "Brand",
      name: product.brand.name
    } : undefined,
    category: product.category.label,
    sku: product.mpn || undefined,
    mpn: product.mpn || undefined,
    gtin: product.gtin || undefined,
    ...(consultationOnly || !packagePieces || !packagePrice ? {} : { offers: {
      "@type": "Offer",
      url,
      priceCurrency: "BRL",
      price: (packagePrice / 100).toFixed(2),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      hasMerchantReturnPolicy: {
        "@id": merchantReturnPolicyId()
      },
      seller: {
        "@id": siteUrl("/#store")
      }
    } }),
    additionalProperty: [
      ...(packagePieces ? [{ "@type": "PropertyValue", name: "Unidades por embalagem", value: String(packagePieces) }] : []),
      { "@type": "PropertyValue", name: "Volume", value: product.volume },
      { "@type": "PropertyValue", name: "Acabamento", value: product.finish },
      ...(product.weightGrams ? [{ "@type": "PropertyValue", name: "Peso", value: `${product.weightGrams} g` }] : [])
    ].filter((item) => Boolean(item.value))
  };
}

export function productMetaDescription(product: CatalogProduct) {
  const consultationOnly = isSourceCatalogConsultationProduct(product);
  const priceLabel = consultationOnly
    ? sourceCatalogPriceLabel(product.wholesalePackage).toLocaleLowerCase("pt-BR")
    : "preço unitário";
  const displayName = productDisplayName(product.name, product.brand.name);
  const nameIncludesBrand = displayName.toLocaleLowerCase("pt-BR").includes(product.brand.name.toLocaleLowerCase("pt-BR"));
  const productName = nameIncludesBrand || !shouldDisplayProductBrand(product.brand.name) ? displayName : `${displayName} da ${product.brand.name}`;
  if (consultationOnly) {
    return compactText(
      `${productName} no atacado. ${priceLabel}: ${money(product.priceCents)}; estoque e embalagem via WhatsApp; mínimo ${siteConfig.wholesale.minimumOrderLabel}.`,
      META_DESCRIPTION_MAX_LENGTH
    );
  }
  const stock = (product.inventory?.quantity || 0) > 0 ? "em estoque" : "disponibilidade sob consulta";
  return compactText(
    `${productName} no atacado. Pedido mínimo ${siteConfig.wholesale.minimumOrderLabel}; preço unitário ${money(product.priceCents)}; embalagem fechada; ${stock}.`,
    META_DESCRIPTION_MAX_LENGTH
  );
}

export function categoryMetadataTitle(label: string, isAllCategory = false, page = 1) {
  const title = isAllCategory ? "Cosméticos no atacado para revenda" : `${label} no atacado para revenda`;
  return page > 1 ? `${title} - página ${page}` : title;
}

export function categoryIntroText(label: string, count: number, isAllCategory = false) {
  const productText = `${count} ${count === 1 ? "produto" : "produtos"}`;
  if (isAllCategory) {
    return compactText(
      `Cosméticos no atacado para revenda: ${productText} de maquiagem, skincare, perfumes, cabelos e acessórios com estoque sinalizado e atendimento para lojistas.`
    );
  }
  return compactText(
    `${label} no atacado para lojistas e revendedores: ${productText} por embalagem fechada, pedido mínimo ${siteConfig.wholesale.minimumOrderLabel} e suporte para montar reposição.`
  );
}

export function categoryMetaDescription(label: string, count: number, isAllCategory = false, page = 1) {
  const pageText = page > 1 ? `Página ${page}: ` : "";
  if (isAllCategory) {
    return compactText(
      `${pageText}cosméticos no atacado para revenda: ${count} produtos por embalagem fechada, pedido mínimo ${siteConfig.wholesale.minimumOrderLabel} e entrega no Brasil.`,
      META_DESCRIPTION_MAX_LENGTH
    );
  }
  return compactText(
    `${pageText}${label} no atacado: ${count} produtos para lojistas e revendedores, vendidos por embalagem fechada, pedido mínimo ${siteConfig.wholesale.minimumOrderLabel} e entrega no Brasil.`,
    META_DESCRIPTION_MAX_LENGTH
  );
}

export function storeSummaryForLlms(profile: StoreProfileView) {
  const pickup = siteConfig.pickupLocation;
  return {
    name: profile.storeName || siteConfig.name,
    description: siteConfig.description,
    address: `${pickup.name}, ${pickup.streetAddress}, ${pickup.city} - ${pickup.state}. ${pickup.note}`,
    whatsapp: publicPhone(profile.whatsapp) || "",
    email: publicEmail(profile.email) || ""
  };
}
